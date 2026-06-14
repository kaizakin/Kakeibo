import type {
  ImportPolicy,
  ImportReport,
  ImportRowReport,
  ParsedExpenseRow,
  CleanExpenseRecord,
  DetectorContext,
  ImportAnomaly,
  NormalizedSplit,
} from "./types";
import { parseCsvContent } from "./csv-parser";
import { normalizeRow, buildUserLookup } from "./normalizers";
import { ALL_DETECTORS } from "./anomaly-detectors";
import { divideWithRemainder } from "@/src/lib/finance/money";

// ---------------------------------------------------------------------------
// Pipeline entry point
// ---------------------------------------------------------------------------

/**
 * Run the full CSV import pipeline: parse → normalize → detect anomalies → classify.
 *
 * This is a PURE function with zero side effects — no database reads or writes.
 * All context (users, memberships, policy) is passed in explicitly.
 *
 * @param csvContent  Raw CSV string (from file upload)
 * @param policy      Configuration: users, memberships, exchange rates, etc.
 * @returns           ImportReport with clean records and flagged anomalies
 */
export function runImportPipeline(
  csvContent: string,
  policy: ImportPolicy,
): ImportReport {
  // ── Step 1: Parse CSV ────────────────────────────────────────────────────
  const { rows: rawRows, malformedAnomalies } = parseCsvContent(csvContent);

  // ── Step 2: Build lookup tables ──────────────────────────────────────────
  const userLookup = buildUserLookup(policy.users);

  const membershipWindows = policy.memberships.map((m) => ({
    userId: m.userId,
    joinedAt: new Date(m.joinedAt),
    leftAt: m.leftAt ? new Date(m.leftAt) : null,
  }));

  // ── Step 3: Normalize all rows ───────────────────────────────────────────
  const parsedRows: ParsedExpenseRow[] = rawRows.map(({ rowNumber, data }) =>
    normalizeRow(rowNumber, data, policy, userLookup),
  );

  // ── Step 4: Build detector context (shared across all detectors) ─────────
  const context: DetectorContext = {
    policy,
    allRows: parsedRows,
    userNameToId: userLookup,
    membershipWindows,
  };

  // ── Step 5: Run all detectors on each row ────────────────────────────────
  const rowReports: ImportRowReport[] = [];
  const allAnomalies: Array<ImportAnomaly & { rowNumber: number }> = [];

  // Include malformed CSV anomalies
  for (const anomaly of malformedAnomalies) {
    allAnomalies.push(anomaly);
  }

  for (const row of parsedRows) {
    // Collect anomalies: normalization-level + detector-level
    const rowAnomalies: ImportAnomaly[] = [...row.normalizationAnomalies];

    for (const detector of ALL_DETECTORS) {
      const detected = detector(row, context);
      rowAnomalies.push(...detected);
    }

    // Also include any malformed anomalies for this row
    const malformedForRow = malformedAnomalies.filter(
      (a) => a.rowNumber === row.rowNumber,
    );
    rowAnomalies.push(...malformedForRow);

    // Classify: requires review if any WARNING or ERROR anomalies
    const hasErrors = rowAnomalies.some((a) => a.severity === "ERROR");
    const hasWarnings = rowAnomalies.some((a) => a.severity === "WARNING");
    const requiresReview = hasErrors || hasWarnings;

    // Try to build a clean record if no blocking errors
    let cleanRecord: CleanExpenseRecord | null = null;
    if (!hasErrors) {
      cleanRecord = tryBuildCleanRecord(row, policy);
    }

    // Track all anomalies globally
    for (const anomaly of rowAnomalies) {
      allAnomalies.push({ ...anomaly, rowNumber: row.rowNumber });
    }

    rowReports.push({
      rowNumber: row.rowNumber,
      rawData: row.raw as unknown as Record<string, string>,
      cleanRecord,
      anomalies: rowAnomalies,
      requiresReview,
    });
  }

  // ── Step 6: Collect clean records ────────────────────────────────────────
  const cleanRecords = rowReports
    .filter((r) => r.cleanRecord !== null)
    .map((r) => r.cleanRecord!);

  const reviewCount = rowReports.filter((r) => r.requiresReview).length;
  const errorCount = rowReports.filter((r) =>
    r.anomalies.some((a) => a.severity === "ERROR"),
  ).length;

  return {
    totalRows: rawRows.length,
    cleanCount: cleanRecords.length,
    reviewCount,
    errorCount,
    cleanRecords,
    rows: rowReports,
    anomalies: allAnomalies,
  };
}

// ---------------------------------------------------------------------------
// Clean record builder
// ---------------------------------------------------------------------------

/**
 * Attempt to build a database-ready CleanExpenseRecord from a parsed row.
 * Returns null if any required field is missing or invalid.
 */
function tryBuildCleanRecord(
  row: ParsedExpenseRow,
  policy: ImportPolicy,
): CleanExpenseRecord | null {
  // All required fields must be present
  if (
    !row.date ||
    !row.paidByUserId ||
    row.amountInCents === null ||
    !row.currency ||
    !row.description
  ) {
    return null;
  }

  // Determine split type (default to EQUAL if missing but not flagged as error)
  const splitType = row.splitType ?? "EQUAL";

  // Determine exchange rate
  const exchangeRateToInr =
    row.currency === "USD" ? policy.usdToInrRate : "1";

  // Build the splits
  const splits = buildSplits(row, splitType);
  if (!splits) return null;

  return {
    rowNumber: row.rowNumber,
    rawData: row.raw as unknown as Record<string, string>,
    paidByUserId: row.paidByUserId,
    amountInCents: row.amountInCents,
    currency: row.currency,
    exchangeRateToInr,
    description: row.description,
    date: row.date.toISOString(),
    splitType,
    isSettlement: row.isSettlement,
    splits,
  };
}

/**
 * Build NormalizedSplit[] based on the split type.
 * Uses integer arithmetic throughout — no floating point for money.
 */
function buildSplits(
  row: ParsedExpenseRow,
  splitType: string,
): NormalizedSplit[] | null {
  const participants = row.splitWith.filter((s) => s.userId !== null);
  if (participants.length === 0) return null;
  if (row.amountInCents === null) return null;

  const totalCents = row.amountInCents;
  const participantIds = participants.map((p) => p.userId!);

  switch (splitType) {
    case "EQUAL": {
      // Use the remainder-safe divider from money.ts
      const shares = divideWithRemainder(
        BigInt(Math.abs(totalCents)),
        participantIds,
      );
      const sign = totalCents < 0 ? -1 : 1;
      return participantIds.map((id) => ({
        userId: id,
        owedAmountInCents: Number(shares.get(id)!) * sign,
      }));
    }

    case "EXACT": {
      // Each participant has an explicit amount in their split detail
      const splits: NormalizedSplit[] = [];
      for (const p of participants) {
        if (p.value === null) return null;
        splits.push({
          userId: p.userId!,
          // Value is in main currency units, convert to cents
          owedAmountInCents: Math.round(p.value * 100),
        });
      }
      return splits;
    }

    case "PERCENTAGE": {
      // Convert percentages to cents using integer math
      const splits: NormalizedSplit[] = [];
      let allocated = 0;

      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        if (p.value === null) return null;

        if (i === participants.length - 1) {
          // Last person gets the remainder to avoid rounding drift
          splits.push({
            userId: p.userId!,
            owedAmountInCents: totalCents - allocated,
          });
        } else {
          const share = Math.round((totalCents * p.value) / 100);
          splits.push({
            userId: p.userId!,
            owedAmountInCents: share,
          });
          allocated += share;
        }
      }
      return splits;
    }

    case "SHARE": {
      // Ratio-based: divide proportionally by share weights
      const totalShares = participants.reduce(
        (sum, p) => sum + (p.value ?? 1),
        0,
      );
      if (totalShares === 0) return null;

      const splits: NormalizedSplit[] = [];
      let allocated = 0;

      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        const weight = p.value ?? 1;

        if (i === participants.length - 1) {
          splits.push({
            userId: p.userId!,
            owedAmountInCents: totalCents - allocated,
          });
        } else {
          const share = Math.round((totalCents * weight) / totalShares);
          splits.push({
            userId: p.userId!,
            owedAmountInCents: share,
          });
          allocated += share;
        }
      }
      return splits;
    }

    default:
      return null;
  }
}
