import type { ParsedExpenseRow, ImportAnomaly, DetectorContext } from "./types";
import { isMemberAt } from "@/src/lib/finance/membership";

/**
 * Anomaly detector function signature.
 * Each detector receives a single parsed row and the shared context,
 * and returns zero or more anomalies found.
 */
type AnomalyDetector = (
  row: ParsedExpenseRow,
  context: DetectorContext,
) => ImportAnomaly[];

// ---------------------------------------------------------------------------
// 1. Currency Ambiguity — flag USD rows, note exchange rate application
// ---------------------------------------------------------------------------

export const detectCurrencyAmbiguity: AnomalyDetector = (row) => {
  if (row.currency === "USD") {
    return [
      {
        code: "CURRENCY_AMBIGUITY",
        severity: "WARNING",
        message: `Row uses USD. Will convert using hardcoded rate (1 USD = 83 INR) for balance calculations.`,
        details: {
          currency: "USD",
          amountInCents: row.amountInCents,
          description: row.description,
        },
      },
    ];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 2. Membership Violation — expense date outside user's membership window
// ---------------------------------------------------------------------------

export const detectMembershipViolation: AnomalyDetector = (row, context) => {
  if (!row.date) return [];

  const anomalies: ImportAnomaly[] = [];

  // Check the payer
  if (row.paidByUserId) {
    const payerWindows = context.membershipWindows.filter(
      (m) => m.userId === row.paidByUserId,
    );
    if (payerWindows.length > 0) {
      const payerActive = payerWindows.some((m) => isMemberAt(m, row.date!));
      if (!payerActive) {
        anomalies.push({
          code: "MEMBERSHIP_VIOLATION",
          severity: "ERROR",
          message: `Payer "${row.paidByName}" was not an active member on ${row.date.toISOString().split("T")[0]}`,
          details: { userId: row.paidByUserId, role: "payer" },
        });
      }
    }
  }

  // Check each split participant
  for (const participant of row.splitWith) {
    if (!participant.userId) continue;

    const windows = context.membershipWindows.filter(
      (m) => m.userId === participant.userId,
    );
    if (windows.length === 0) continue; // Unknown user handled by another detector

    const active = windows.some((m) => isMemberAt(m, row.date!));
    if (!active) {
      anomalies.push({
        code: "MEMBERSHIP_VIOLATION",
        severity: "ERROR",
        message: `"${participant.userName}" was not an active member on ${row.date!.toISOString().split("T")[0]}`,
        details: { userId: participant.userId, userName: participant.userName, role: "participant" },
      });
    }
  }

  return anomalies;
};

// ---------------------------------------------------------------------------
// 3. Duplicate Detection — exact and conflicting duplicates
// ---------------------------------------------------------------------------

/**
 * Generate a hash key for duplicate detection.
 * Uses date + payer + normalized description (lowercase, stripped of punctuation).
 */
function duplicateKey(row: ParsedExpenseRow): string | null {
  if (!row.date || !row.paidByName) return null;
  const dateStr = row.date.toISOString().split("T")[0];
  const desc = row.description.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  return `${dateStr}|${row.paidByName.toLowerCase().trim()}|${desc}`;
}

/**
 * Generate a looser hash for conflicting duplicate detection.
 * Uses date + significant words in description (ignoring payer differences).
 */
function looseKey(row: ParsedExpenseRow): string | null {
  if (!row.date) return null;
  const dateStr = row.date.toISOString().split("T")[0];
  // Extract significant words (3+ chars) from description
  const words = row.description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .sort()
    .join(" ");
  return `${dateStr}|${words}`;
}

export const detectDuplicates: AnomalyDetector = (row, context) => {
  const anomalies: ImportAnomaly[] = [];
  const key = duplicateKey(row);
  const loose = looseKey(row);

  for (const other of context.allRows) {
    if (other.rowNumber === row.rowNumber) continue;

    // Exact duplicate: same date + same payer + same/similar description + same amount
    const otherKey = duplicateKey(other);
    if (key && otherKey && key === otherKey && row.amountInCents === other.amountInCents) {
      anomalies.push({
        code: "DUPLICATE",
        severity: "WARNING",
        message: `Possible duplicate of row ${other.rowNumber}: same date, payer, description, and amount`,
        details: {
          matchedRow: other.rowNumber,
          amount: row.amountInCents,
        },
      });
      break; // One duplicate flag is enough per row
    }

    // Conflicting duplicate: same date + similar description but different amounts or payers
    const otherLoose = looseKey(other);
    if (
      loose &&
      otherLoose &&
      loose === otherLoose &&
      key !== otherKey && // Not already an exact match
      (row.amountInCents !== other.amountInCents || row.paidByName.toLowerCase() !== other.paidByName.toLowerCase())
    ) {
      anomalies.push({
        code: "CONFLICTING_DUPLICATE",
        severity: "ERROR",
        message: `Possible conflict with row ${other.rowNumber}: similar event on same date but different ${row.amountInCents !== other.amountInCents ? "amounts" : "payers"}`,
        details: {
          matchedRow: other.rowNumber,
          thisAmount: row.amountInCents,
          otherAmount: other.amountInCents,
          thisPayer: row.paidByName,
          otherPayer: other.paidByName,
        },
      });
      break;
    }
  }

  return anomalies;
};

// ---------------------------------------------------------------------------
// 4. Settlement Misclassification
// ---------------------------------------------------------------------------

export const detectSettlementMisclassification: AnomalyDetector = (row) => {
  if (row.isSettlement) {
    return [
      {
        code: "SETTLEMENT_MISCLASSIFICATION",
        severity: "WARNING",
        message: `"${row.description}" looks like a settlement/payment, not a shared expense. Should this be recorded as a debt settlement?`,
        details: { description: row.description },
      },
    ];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 5. Negative Amount
// ---------------------------------------------------------------------------

export const detectNegativeAmount: AnomalyDetector = (row) => {
  if (row.amountInCents !== null && row.amountInCents < 0) {
    return [
      {
        code: "NEGATIVE_AMOUNT",
        severity: "WARNING",
        message: `Negative amount (${row.amountInCents} cents). Could be a refund, correction, or data entry error.`,
        details: { amountInCents: row.amountInCents, description: row.description },
      },
    ];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 6. Number Format Issues (already caught by normalizer, re-emitted here for completeness)
// ---------------------------------------------------------------------------

// This detector is a no-op — normalization anomalies are already collected
// during the normalizer pass. Included for architectural completeness.
export const detectNumberFormatIssues: AnomalyDetector = () => [];

// ---------------------------------------------------------------------------
// 7. Missing Critical Fields
// ---------------------------------------------------------------------------

export const detectMissingFields: AnomalyDetector = (row) => {
  const anomalies: ImportAnomaly[] = [];

  if (!row.paidByName) {
    anomalies.push({
      code: "MISSING_CRITICAL_FIELD",
      severity: "ERROR",
      message: "Missing payer (paid_by field is empty)",
    });
  }

  if (row.amountInCents === null) {
    anomalies.push({
      code: "MISSING_CRITICAL_FIELD",
      severity: "ERROR",
      message: "Missing or unparseable amount",
      details: { rawAmount: row.raw.amount },
    });
  }

  if (!row.date && row.raw.date.trim().length === 0) {
    anomalies.push({
      code: "MISSING_CRITICAL_FIELD",
      severity: "ERROR",
      message: "Missing date field",
    });
  }

  if (!row.description) {
    anomalies.push({
      code: "MISSING_CRITICAL_FIELD",
      severity: "ERROR",
      message: "Missing description",
    });
  }

  if (!row.currency && !row.raw.currency.trim()) {
    anomalies.push({
      code: "MISSING_CRITICAL_FIELD",
      severity: "ERROR",
      message: "Missing currency — cannot determine if INR or USD",
      details: { rawCurrency: row.raw.currency },
    });
  }

  return anomalies;
};

// ---------------------------------------------------------------------------
// 8. Invalid Split Math
// ---------------------------------------------------------------------------

export const detectInvalidSplitMath: AnomalyDetector = (row) => {
  const anomalies: ImportAnomaly[] = [];

  if (row.splitType === "PERCENTAGE") {
    // Check if percentages sum to 100
    const details = row.splitWith.filter((s) => s.value !== null);
    if (details.length > 0) {
      const sum = details.reduce((acc, s) => acc + (s.value ?? 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        anomalies.push({
          code: "INVALID_SPLIT_MATH",
          severity: "ERROR",
          message: `Percentage splits sum to ${sum}%, not 100%`,
          details: {
            percentageSum: sum,
            participants: details.map((d) => `${d.userName}: ${d.value}%`).join(", "),
          },
        });
      }
    }
  }

  if (row.splitType === "EXACT" && row.amountInCents !== null) {
    // Check if exact amounts sum to total
    const details = row.splitWith.filter((s) => s.value !== null);
    if (details.length > 0) {
      // Detail values are in main currency units, convert to cents
      const sum = details.reduce((acc, s) => acc + Math.round((s.value ?? 0) * 100), 0);
      if (sum !== row.amountInCents) {
        anomalies.push({
          code: "INVALID_SPLIT_MATH",
          severity: "ERROR",
          message: `Exact split amounts sum to ${sum} cents, but total is ${row.amountInCents} cents`,
          details: {
            splitSum: sum,
            totalAmount: row.amountInCents,
            difference: row.amountInCents - sum,
          },
        });
      }
    }
  }

  return anomalies;
};

// ---------------------------------------------------------------------------
// 9. Unknown Guest Users
// ---------------------------------------------------------------------------

export const detectUnknownUsers: AnomalyDetector = (row, context) => {
  const anomalies: ImportAnomaly[] = [];

  // Check payer
  if (row.paidByName && !row.paidByUserId) {
    anomalies.push({
      code: "UNKNOWN_GUEST_USER",
      severity: "WARNING",
      message: `Payer "${row.paidByName}" is not a registered group member`,
      details: { userName: row.paidByName, role: "payer" },
    });
  }

  // Check split participants
  for (const participant of row.splitWith) {
    if (participant.userName && !participant.userId) {
      anomalies.push({
        code: "UNKNOWN_GUEST_USER",
        severity: "WARNING",
        message: `"${participant.userName}" in split is not a registered group member`,
        details: { userName: participant.userName, role: "participant" },
      });
    }
  }

  return anomalies;
};

// ---------------------------------------------------------------------------
// 10. Zero-Value Transaction
// ---------------------------------------------------------------------------

export const detectZeroValue: AnomalyDetector = (row) => {
  if (row.amountInCents === 0) {
    return [
      {
        code: "ZERO_VALUE_TRANSACTION",
        severity: "WARNING",
        message: `Zero-amount transaction: "${row.description}". This has no financial effect.`,
        details: { description: row.description },
      },
    ];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 11. Future-Dated Record
// ---------------------------------------------------------------------------

export const detectFutureDated: AnomalyDetector = (row, context) => {
  if (row.date && row.date.getTime() > context.policy.now.getTime()) {
    return [
      {
        code: "FUTURE_DATED_RECORD",
        severity: "WARNING",
        message: `Date ${row.date.toISOString().split("T")[0]} is in the future`,
        details: {
          expenseDate: row.date.toISOString(),
          serverDate: context.policy.now.toISOString(),
        },
      },
    ];
  }
  return [];
};

// ---------------------------------------------------------------------------
// Detector registry — ordered array of all detectors
// ---------------------------------------------------------------------------

export const ALL_DETECTORS: AnomalyDetector[] = [
  detectMissingFields,        // 7 — run first so other detectors can assume fields exist
  detectCurrencyAmbiguity,    // 1
  detectMembershipViolation,  // 2
  detectDuplicates,           // 3
  detectSettlementMisclassification, // 4
  detectNegativeAmount,       // 5
  detectNumberFormatIssues,   // 6 (no-op, handled by normalizer)
  detectInvalidSplitMath,     // 8
  detectUnknownUsers,         // 9
  detectZeroValue,            // 10
  detectFutureDated,          // 11
  // 12 (MALFORMED_CSV_ROW) is handled by csv-parser.ts, not here
];
