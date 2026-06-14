"use server";

import { prisma as db } from "@/src/lib/db";
import type { RawCsvRow, ImportPolicy, ImportRowReport, ImportAnomaly } from "@/src/lib/import/types";
import { normalizeRow, buildUserLookup } from "@/src/lib/import/normalizers";
import { tryBuildCleanRecord, buildSplits } from "@/src/lib/import/pipeline";
import {
  ALL_DETECTORS,
} from "@/src/lib/import/anomaly-detectors";
import type { ParsedExpenseRow } from "@/src/lib/import/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportRowEdit {
  description: string;
  payer: string;         // Payer name from the edit form (e.g. "Aisha")
  amount: string;        // Raw amount string (e.g. "1200")
  paidByUserId: string | null;
  date: string;          // DD-MM-YYYY format
  splitType: string;     // equal | exact | percentage | share
  splitWith: string;     // Semicolon-separated names
  splitDetails: string;  // Semicolon-separated name-value pairs
}

export interface UpdateImportRowResult {
  success: boolean;
  updatedRow: {
    rowNumber: number;
    id: string | null;
    rawData: Record<string, string>;
    cleanRecord: {
      rowNumber: number;
      rawData: Record<string, string>;
      paidByUserId: string;
      amountInCents: number;
      currency: "INR" | "USD";
      exchangeRateToInr: string;
      description: string;
      date: string;
      splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARE";
      isSettlement: boolean;
      splits: Array<{ userId: string; owedAmountInCents: number }>;
    } | null;
    anomalies: ImportAnomaly[];
    requiresReview: boolean;
  } | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSplitType(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  switch (lower) {
    case "equal": return "EQUAL";
    case "unequal":
    case "exact": return "EXACT";
    case "percentage": return "PERCENTAGE";
    case "share": return "SHARE";
    default: return null;
  }
}

/**
 * Re-parse a single row's data through the normalizer and anomaly detectors,
 * producing fresh normalizedSplits and anomalies. This is the core logic
 * that ensures no corrupted math reaches the database.
 */
function reparseRow(
  rowNumber: number,
  rawRow: RawCsvRow,
  policy: ImportPolicy,
): {
  parsedRow: ParsedExpenseRow;
  cleanRecord: ImportRowReport["cleanRecord"];
  anomalies: ImportAnomaly[];
  requiresReview: boolean;
} {
  // Build user lookup from policy users
  const userLookup = buildUserLookup(policy.users);

  // Build membership windows
  const membershipWindows = policy.memberships.map((m) => ({
    userId: m.userId,
    joinedAt: new Date(m.joinedAt),
    leftAt: m.leftAt ? new Date(m.leftAt) : null,
  }));

  // Step 1: Normalize the row
  const parsedRow = normalizeRow(
    rowNumber,
    rawRow,
    policy,
    userLookup,
  );

  // Step 2: Build detector context and run all detectors
  const context = {
    policy,
    allRows: [], // Single-row context; cross-row checks won't apply here
    userNameToId: userLookup,
    membershipWindows,
  };

  const anomalies: ImportAnomaly[] = [...parsedRow.normalizationAnomalies];

  for (const detector of ALL_DETECTORS) {
    const detected = detector(parsedRow, context);
    anomalies.push(...detected);
  }

  const hasErrors = anomalies.some((a) => a.severity === "ERROR");
  const hasWarnings = anomalies.some((a) => a.severity === "WARNING");
  const requiresReview = hasErrors || hasWarnings;

  // Step 3: Build clean record if no blocking errors
  let cleanRecord: ImportRowReport["cleanRecord"] = null;
  if (!hasErrors) {
    cleanRecord = tryBuildCleanRecord(parsedRow, policy);
  }

  return { parsedRow, cleanRecord, anomalies, requiresReview };
}

// ---------------------------------------------------------------------------
// Server Action: Edit an import row in the review phase
// ---------------------------------------------------------------------------

/**
 * Update an ImportRow's data after the user edits it in the review phase.
 *
 * Re-parses edited fields through the full normalization + anomaly detection
 * pipeline so that:
 *   - normalizedSplits are re-computed from scratch (no stale math)
 *   - anomalies are re-detected on the new data
 *   - The row status is set to NEEDS_REVIEW, forcing user re-approval
 *
 * Returns the updated row data so the review table can reflect changes
 * without a full page reload.
 */
export async function updateImportRow(
  importRowId: string,
  edits: ImportRowEdit,
): Promise<UpdateImportRowResult> {
  try {
    const result = await db.$transaction(async (tx) => {
      // ── Fetch the import row with batch info ───────────────────────────
      const importRow = await tx.importRow.findUnique({
        where: { id: importRowId },
        include: { batch: { select: { groupId: true } } },
      });

      if (!importRow) {
        throw new Error("ImportRow not found");
      }

      const groupId = importRow.batch.groupId;

      // ── Fetch group members for user resolution ────────────────────────
      const memberships = await tx.groupMembership.findMany({
        where: { groupId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      const users = memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name ?? m.user.email,
        email: m.user.email,
      }));

      // ── Resolve payer name to user ID ──────────────────────────────────
      let paidByUserId: string | null = null;
      const payerName = edits.payer.trim();
      if (payerName) {
        const member = memberships.find(
          (m) => m.user.name?.toLowerCase() === payerName.toLowerCase(),
        );
        if (member) {
          paidByUserId = member.user.id;
        }
      }

      // ── Parse the amount ──────────────────────────────────────────────
      let amountInCents: number | null = null;
      const cleanedAmount = edits.amount.replace(/[₹$,\s]/g, "").trim();
      const parsedAmount = Number(cleanedAmount);
      if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
        amountInCents = Math.round(parsedAmount * 100);
      }

      // ── Parse the date ────────────────────────────────────────────────
      let parsedDate: Date | null = null;
      if (edits.date) {
        const parts = edits.date.split("-");
        if (parts.length === 3) {
          const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          if (!isNaN(d.getTime())) parsedDate = d;
        }
      }

      // Build the raw data record from edits
      const rawData: Record<string, string> = {
        date: edits.date,
        description: edits.description,
        paid_by: payerName || "",
        amount: edits.amount,
        currency: "INR",
        split_type: edits.splitType,
        split_with: edits.splitWith,
        split_details: edits.splitDetails,
        notes: "",
      };

      // ── Re-parse through normalizer + anomaly detectors ────────────────
      const policy: ImportPolicy = {
        now: new Date(),
        users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
        memberships: memberships.map((m) => ({
          userId: m.user.id,
          joinedAt: m.joinedAt.toISOString(),
          leftAt: m.leftAt?.toISOString() ?? null,
        })),
        defaultCurrency: "INR",
        usdToInrRate: "83",
        groupId,
      };

      const rawRow: RawCsvRow = {
        date: edits.date,
        description: edits.description,
        paid_by: payerName || "",
        amount: edits.amount,
        currency: "INR",
        split_type: edits.splitType,
        split_with: edits.splitWith,
        split_details: edits.splitDetails,
        notes: "",
      };

      const { cleanRecord, anomalies, requiresReview } = reparseRow(importRow.rowNumber, rawRow, policy);

      // Determine status after re-parse
      const hasErrors = anomalies.some((a) => a.severity === "ERROR");
      const hasWarnings = anomalies.some((a) => a.severity === "WARNING");
      const newStatus = hasErrors || hasWarnings ? "NEEDS_REVIEW" : "CLEAN";

      // ── Delete old anomalies ──────────────────────────────────────────
      await tx.importAnomaly.deleteMany({
        where: { importRowId },
      });

      // ── Create new anomalies ──────────────────────────────────────────
      if (anomalies.length > 0) {
        await tx.importAnomaly.createMany({
          data: anomalies.map((a) => ({
            importRowId,
            code: a.code as any,
            severity: a.severity as any,
            message: a.message,
            details: (a.details ?? null) as any,
          })) as any,
        });
      }

      // ── Update the ImportRow with re-parsed values ─────────────────────
      await tx.importRow.update({
        where: { id: importRowId },
        data: {
          rawData,
          status: newStatus,
          paidByUserId: cleanRecord?.paidByUserId ?? paidByUserId,
          amountInCents: cleanRecord?.amountInCents ?? amountInCents,
          description: cleanRecord?.description ?? edits.description,
          date: cleanRecord?.date ? new Date(cleanRecord.date) : parsedDate,
          currency: (cleanRecord?.currency as any) ?? null,
          exchangeRateToInr: cleanRecord?.exchangeRateToInr ?? null,
          splitType: (cleanRecord?.splitType as any) ?? null,
          isSettlement: cleanRecord?.isSettlement ?? null,
          normalizedSplits: (cleanRecord?.splits ?? null) as any,
        },
      });

      // ── Build the updated row report for the frontend ──────────────────
      const updatedRow = {
        rowNumber: importRow.rowNumber,
        id: importRowId,
        rawData,
        cleanRecord: cleanRecord as ImportRowReport["cleanRecord"],
        anomalies,
        requiresReview,
      };

      return { updatedRow };
    });

    return {
      success: true,
      updatedRow: result.updatedRow,
      error: null,
    };
  } catch (error) {
    console.error("updateImportRow failed:", error);
    return {
      success: false,
      updatedRow: null,
      error: error instanceof Error ? error.message : "Unknown error updating import row",
    };
  }
}
