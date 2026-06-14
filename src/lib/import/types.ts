import type { SplitType } from "@prisma/client";
import type { SupportedCurrency } from "@/src/lib/finance/money";

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
  date: string;
  splitType: SplitType;
  isSettlement: boolean;
  splits: NormalizedSplit[];
}

export interface ImportRowReport {
  rowNumber: number;
  rawData: Record<string, string>;
  cleanRecord: CleanExpenseRecord | null;
  anomalies: ImportAnomaly[];
  requiresReview: boolean;
}

export interface ImportReport {
  totalRows: number;
  cleanRecords: CleanExpenseRecord[];
  rows: ImportRowReport[];
  anomalies: Array<ImportAnomaly & { rowNumber: number }>;
}

export interface ImportUser {
  id: string;
  name: string;
  email?: string;
}

export interface ImportMembership {
  userId: string;
  joinedAt: string;
  leftAt: string | null;
}

export interface ImportPolicy {
  now: Date;
  users: readonly ImportUser[];
  memberships: readonly ImportMembership[];
  defaultCurrency: SupportedCurrency;
  usdToInrRate: string;
}
