import type { SplitType } from "@prisma/client";
import type { SupportedCurrency } from "@/src/lib/finance/money";

// ---------------------------------------------------------------------------
// Anomaly types
// ---------------------------------------------------------------------------

export type AnomalyCode =
  | "CURRENCY_AMBIGUITY"
  | "MEMBERSHIP_VIOLATION"
  | "DUPLICATE"
  | "CONFLICTING_DUPLICATE"
  | "SETTLEMENT_MISCLASSIFICATION"
  | "NEGATIVE_AMOUNT"
  | "NUMBER_FORMAT_NORMALIZED"
  | "MISSING_CRITICAL_FIELD"
  | "INVALID_SPLIT_MATH"
  | "UNKNOWN_GUEST_USER"
  | "ZERO_VALUE_TRANSACTION"
  | "FUTURE_DATED_RECORD"
  | "MALFORMED_CSV_ROW"
  | "INVALID_DATE"
  | "INVALID_CURRENCY"
  | "INVALID_SPLIT_TYPE";

export type AnomalySeverity = "INFO" | "WARNING" | "ERROR";

export interface ImportAnomaly {
  code: AnomalyCode;
  severity: AnomalySeverity;
  message: string;
  details?: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Raw CSV row — mirrors actual column headers from expenses_report.csv
// ---------------------------------------------------------------------------

export interface RawCsvRow {
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
}

/** The expected CSV column headers (lowercase, trimmed). */
export const CSV_HEADERS = [
  "date",
  "description",
  "paid_by",
  "amount",
  "currency",
  "split_type",
  "split_with",
  "split_details",
  "notes",
] as const;

// ---------------------------------------------------------------------------
// Parsed / normalized row — after normalizer pass
// ---------------------------------------------------------------------------

export interface SplitDetail {
  userName: string;
  /** Resolved user ID (null if unknown user). */
  userId: string | null;
  /** For EXACT: amount in cents. For PERCENTAGE: integer percent. For SHARE: ratio weight. */
  value: number | null;
}

export interface ParsedExpenseRow {
  rowNumber: number;
  raw: RawCsvRow;

  // Normalized values (null when normalization failed)
  date: Date | null;
  description: string;
  paidByName: string;
  paidByUserId: string | null;
  amountInCents: number | null;
  currency: SupportedCurrency | null;
  splitType: SplitType | null;
  /** Original split_type string from CSV before normalization. */
  rawSplitType: string;
  splitWith: SplitDetail[];
  isSettlement: boolean;

  /** Anomalies collected during normalization. */
  normalizationAnomalies: ImportAnomaly[];
}

// ---------------------------------------------------------------------------
// Clean record — ready for DB insertion
// ---------------------------------------------------------------------------

export interface NormalizedSplit {
  userId: string;
  owedAmountInCents: number;
}

export interface CleanExpenseRecord {
  rowNumber: number;
  rawData: Record<string, string>;
  paidByUserId: string;
  amountInCents: number;
  currency: SupportedCurrency;
  exchangeRateToInr: string;
  description: string;
  date: string; // ISO string
  splitType: SplitType;
  isSettlement: boolean;
  splits: NormalizedSplit[];
}

// ---------------------------------------------------------------------------
// Import report — output of the pipeline
// ---------------------------------------------------------------------------

export interface ImportRowReport {
  rowNumber: number;
  rawData: Record<string, string>;
  cleanRecord: CleanExpenseRecord | null;
  anomalies: ImportAnomaly[];
  /** True if any anomaly has severity WARNING or ERROR. */
  requiresReview: boolean;
}

export interface ImportReport {
  totalRows: number;
  cleanCount: number;
  reviewCount: number;
  errorCount: number;
  cleanRecords: CleanExpenseRecord[];
  rows: ImportRowReport[];
  anomalies: Array<ImportAnomaly & { rowNumber: number }>;
}

// ---------------------------------------------------------------------------
// Import policy — configuration for the pipeline
// ---------------------------------------------------------------------------

export interface ImportUser {
  id: string;
  name: string;
  email?: string;
}

export interface ImportMembership {
  userId: string;
  joinedAt: string; // ISO date string
  leftAt: string | null; // ISO date string or null
}

export interface ImportPolicy {
  now: Date;
  users: readonly ImportUser[];
  memberships: readonly ImportMembership[];
  defaultCurrency: SupportedCurrency;
  usdToInrRate: string; // Decimal string, e.g. "83"
  groupId: string;
}

// ---------------------------------------------------------------------------
// Detector context — shared state for cross-row anomaly detection
// ---------------------------------------------------------------------------

export interface DetectorContext {
  policy: ImportPolicy;
  allRows: ParsedExpenseRow[];
  /** Lowercase name → user ID mapping for user resolution. */
  userNameToId: Map<string, string>;
  membershipWindows: Array<{
    userId: string;
    joinedAt: Date;
    leftAt: Date | null;
  }>;
}
