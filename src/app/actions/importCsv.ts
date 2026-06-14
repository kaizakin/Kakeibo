"use server";

import { prisma as db } from "@/src/lib/db";
import { runImportPipeline } from "@/src/lib/import/pipeline";
import type { ImportPolicy, ImportReport } from "@/src/lib/import/types";
import type { AnomalyCode, AnomalySeverity, Currency, SplitType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Helper: extract unique user names from CSV content
// ---------------------------------------------------------------------------

/**
 * Lightweight CSV name extractor — finds all unique person names from the
 * paid_by, split_with, and split_details columns before the pipeline runs,
 * so we can auto-provision user records and memberships.
 */
function extractNamesFromCsv(csvContent: string): string[] {
  const lines = csvContent.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Find column indices from the header
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const paidByIdx = header.indexOf("paid_by");
  const splitWithIdx = header.indexOf("split_with");
  const splitDetailsIdx = header.indexOf("split_details");

  if (paidByIdx === -1) return [];

  // Lowercase-normalized dedup to handle "Priya" vs "priya" variants
  const seen = new Set<string>();
  const names: string[] = [];

  function add(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(trimmed);
  }

  for (let i = 1; i < lines.length; i++) {
    // Simple split — handles most CSVs; quoted commas are unlikely in name columns
    const cols = lines[i].split(",").map((c) => c.trim());

    // paid_by
    if (paidByIdx < cols.length) add(cols[paidByIdx]);

    // split_with — semicolon-separated names
    if (splitWithIdx >= 0 && splitWithIdx < cols.length) {
      for (const name of cols[splitWithIdx].split(";")) {
        add(name);
      }
    }

    // split_details — "Name value" or "Name value%" pairs
    if (splitDetailsIdx >= 0 && splitDetailsIdx < cols.length) {
      for (const part of cols[splitDetailsIdx].split(";")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        // Pattern: "Name value" or "Name value%" — extract the name before the number
        const match = /^(.+?)\s+\d/.exec(trimmed);
        if (match) {
          add(match[1].trim());
        } else {
          add(trimmed);
        }
      }
    }
  }

  return names;
}

// ---------------------------------------------------------------------------
// Helper: derive a placeholder email from a user name
// ---------------------------------------------------------------------------

/** Generate a deterministic placeholder email for auto-provisioned users. */
function placeholderEmail(name: string, groupId: string): string {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, ".");
  return `${safeName}@${groupId}.imported.local`;
}

// ---------------------------------------------------------------------------
// Server Action: Stage an import (Parse & Analyze)
// ---------------------------------------------------------------------------

export interface StageImportResult {
  success: boolean;
  batchId: string | null;
  report: ImportReport | null;
  error: string | null;
}

/**
 * Parse a CSV string, run the anomaly detection pipeline, and stage
 * the results into the ImportBatch / ImportRow / ImportAnomaly tables.
 *
 * This does NOT create any Expense records — that happens in commitImport.
 *
 * Auto-provisions users and group memberships from CSV names so the import
 * works even after db:nuke (no seed data in the database).
 *
 * Uses the idempotencyKey to prevent double-processing of the same upload.
 */
export async function stageImport(
  groupId: string,
  csvContent: string,
  idempotencyKey: string,
): Promise<StageImportResult> {
  try {
    // ── Ensure the group exists ─────────────────────────────────────────────
    const groupName = groupId
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    await db.group.upsert({
      where: { id: groupId },
      update: {},
      create: { id: groupId, name: groupName },
    });

    // ── Idempotency check ──────────────────────────────────────────────────
    const existing = await db.importBatch.findUnique({
      where: { groupId_idempotencyKey: { groupId, idempotencyKey } },
    });

    if (existing) {
      return {
        success: false,
        batchId: existing.id,
        report: null,
        error: "This CSV has already been staged. Check the existing import batch.",
      };
    }

    // ── Auto-provision users from CSV names ─────────────────────────────────
    // After db:nuke there are no users. Extract names from the CSV and create
    // user records + group memberships before running the pipeline.
    const csvNames = extractNamesFromCsv(csvContent);

    for (const rawName of csvNames) {
      const name = rawName.trim();
      if (!name) continue;

      const email = placeholderEmail(name, groupId);
      const user = await db.user.upsert({
        where: { email },
        update: { name },
        create: { name, email },
      });

      // Create group membership if not already a member
      const existingMembership = await db.groupMembership.findFirst({
        where: { groupId, userId: user.id, leftAt: null },
      });

      if (!existingMembership) {
        await db.groupMembership.create({
          data: {
            groupId,
            userId: user.id,
            joinedAt: new Date("2020-01-01"),
            leftAt: null,
          },
        });
      }
    }

    // ── Build import policy from database state ────────────────────────────
    const [users, memberships] = await Promise.all([
      db.user.findMany({
        where: {
          memberships: { some: { groupId } },
        },
        select: { id: true, name: true, email: true },
      }),
      db.groupMembership.findMany({
        where: { groupId },
        select: { userId: true, joinedAt: true, leftAt: true },
      }),
    ]);

    const policy: ImportPolicy = {
      now: new Date(),
      users: users.map((u) => ({
        id: u.id,
        name: u.name ?? u.email,
        email: u.email,
      })),
      memberships: memberships.map((m) => ({
        userId: m.userId,
        joinedAt: m.joinedAt.toISOString(),
        leftAt: m.leftAt?.toISOString() ?? null,
      })),
      defaultCurrency: "INR",
      usdToInrRate: "83",
      groupId,
    };

    // ── Run the pure import pipeline ───────────────────────────────────────
    const report = runImportPipeline(csvContent, policy);

    // ── Persist to staging tables in a single transaction ──────────────────
    // Also populate report row IDs so the review table can reference them for editing.
    const batch = await db.$transaction(async (tx) => {
      const importBatch = await tx.importBatch.create({
        data: {
          groupId,
          idempotencyKey,
          status: "REVIEW",
        },
      });

      for (const row of report.rows) {
        const clean = row.cleanRecord;
        const hasErrors = row.anomalies.some((a) => a.severity === "ERROR");
        const hasWarnings = row.anomalies.some((a) => a.severity === "WARNING");
        const status = hasErrors || hasWarnings ? "NEEDS_REVIEW" : "CLEAN";

        const importRow = await tx.importRow.create({
          data: {
            batchId: importBatch.id,
            rowNumber: row.rowNumber,
            rawData: row.rawData,
            status,
            paidByUserId: clean?.paidByUserId ?? null,
            amountInCents: clean?.amountInCents ?? null,
            currency: clean?.currency as Currency | null ?? null,
            exchangeRateToInr: clean?.exchangeRateToInr ?? null,
            description: clean?.description ?? null,
            date: clean?.date ? new Date(clean.date) : null,
            splitType: clean?.splitType as SplitType | null ?? null,
            isSettlement: clean?.isSettlement ?? null,
            normalizedSplits: clean?.splits ?? null,
          },
        });

        // Populate the report row with its DB ID for the review table
        (row as { id: string | null }).id = importRow.id;

        if (row.anomalies.length > 0) {
          await tx.importAnomaly.createMany({
            data: row.anomalies.map((a) => ({
              importRowId: importRow.id,
              code: a.code as AnomalyCode,
              severity: a.severity as AnomalySeverity,
              message: a.message,
              details: a.details ?? null,
            })),
          });
        }
      }

      return importBatch;
    }, { timeout: 30000 });

    return {
      success: true,
      batchId: batch.id,
      report,
      error: null,
    };
  } catch (error) {
    console.error("stageImport failed:", error);
    return {
      success: false,
      batchId: null,
      report: null,
      error: error instanceof Error ? error.message : "Unknown error during import staging",
    };
  }
}
