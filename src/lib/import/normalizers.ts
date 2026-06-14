import { parse, isValid } from "date-fns";
import type { SplitType } from "@prisma/client";
import type {
  RawCsvRow,
  ParsedExpenseRow,
  SplitDetail,
  ImportAnomaly,
  ImportPolicy,
  ImportUser,
} from "./types";

// ---------------------------------------------------------------------------
// Amount normalization
// ---------------------------------------------------------------------------

export interface NormalizedAmount {
  /** Amount in the smallest currency unit (cents/paise). */
  cents: number;
  /** Whether any cleaning was needed. */
  wasNormalized: boolean;
  /** Currency detected from symbols like $ or ₹ (null if none found). */
  detectedCurrency: "INR" | "USD" | null;
  /** Info anomalies generated during normalization. */
  anomalies: ImportAnomaly[];
}

/**
 * Normalize a raw amount string into integer cents/paise.
 *
 * Handles: commas ("1,200"), currency symbols ("$120", "₹1500"),
 * trailing "/−" ("2300/−"), whitespace, and decimal amounts (899.995).
 *
 * CSV amounts are in the MAIN currency unit (rupees/dollars), not cents.
 * We multiply by 100 to convert to the smallest unit.
 *
 * Returns null if the string cannot be parsed into a valid number.
 */
export function normalizeAmount(raw: string): NormalizedAmount | null {
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const anomalies: ImportAnomaly[] = [];
  let cleaned = raw.trim();
  let wasNormalized = false;
  let detectedCurrency: "INR" | "USD" | null = null;

  // Detect and strip currency symbols
  if (cleaned.startsWith("$")) {
    detectedCurrency = "USD";
    cleaned = cleaned.slice(1).trim();
    wasNormalized = true;
  } else if (cleaned.startsWith("₹")) {
    detectedCurrency = "INR";
    cleaned = cleaned.slice(1).trim();
    wasNormalized = true;
  }

  // Strip trailing "/-" or "/−" (Indian notation for whole amounts)
  if (/\/-?\s*$/.test(cleaned)) {
    cleaned = cleaned.replace(/\/-?\s*$/, "");
    wasNormalized = true;
  }

  // Strip commas (thousand separators)
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/,/g, "");
    wasNormalized = true;
  }

  // Strip remaining whitespace
  cleaned = cleaned.trim();

  // Parse as a number
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  // Convert to cents/paise by multiplying by 100.
  // Use Math.round to handle floating-point imprecision (e.g., 899.995 * 100).
  const cents = Math.round(parsed * 100);

  // Check if the original had suspicious decimal precision
  const decimalMatch = /\.(\d+)$/.exec(cleaned);
  if (decimalMatch && decimalMatch[1].length > 2) {
    anomalies.push({
      code: "NUMBER_FORMAT_NORMALIZED",
      severity: "INFO",
      message: `Amount "${raw}" has more than 2 decimal places; rounded to nearest paise: ${cents}`,
      details: { originalValue: raw, roundedCents: cents },
    });
    wasNormalized = true;
  }

  if (wasNormalized && anomalies.length === 0) {
    anomalies.push({
      code: "NUMBER_FORMAT_NORMALIZED",
      severity: "INFO",
      message: `Amount "${raw}" was normalized to ${cents} (smallest currency unit)`,
      details: { originalValue: raw, normalizedCents: cents },
    });
  }

  return { cents, wasNormalized, detectedCurrency, anomalies };
}

// ---------------------------------------------------------------------------
// Date normalization
// ---------------------------------------------------------------------------

/**
 * Parse a date string strictly. The CSV uses DD-MM-YYYY format primarily.
 *
 * Attempts these formats in order:
 *   1. DD-MM-YYYY  (primary format in expenses_report.csv)
 *   2. DD/MM/YYYY
 *   3. YYYY-MM-DD  (ISO)
 *   4. MMM-DD      (e.g., "Mar-14" — invalid, will fail validation)
 *
 * Returns null for unparseable dates.
 */
export function normalizeDate(raw: string): Date | null {
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const trimmed = raw.trim();

  // Try DD-MM-YYYY
  const ddmmyyyy = parse(trimmed, "dd-MM-yyyy", new Date());
  if (isValid(ddmmyyyy)) {
    return ddmmyyyy;
  }

  // Try DD/MM/YYYY
  const ddmmyyyySlash = parse(trimmed, "dd/MM/yyyy", new Date());
  if (isValid(ddmmyyyySlash)) {
    return ddmmyyyySlash;
  }

  // Try YYYY-MM-DD (ISO)
  const iso = parse(trimmed, "yyyy-MM-dd", new Date());
  if (isValid(iso)) {
    return iso;
  }

  // Could not parse — will be flagged as INVALID_DATE
  return null;
}

// ---------------------------------------------------------------------------
// User name resolution
// ---------------------------------------------------------------------------

/**
 * Build a case-insensitive lookup map from user name → user ID.
 * Also handles common variations (e.g., "Priya S" should fuzzy-match "Priya").
 */
export function buildUserLookup(
  users: readonly ImportUser[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const user of users) {
    map.set(user.name.toLowerCase().trim(), user.id);
  }
  return map;
}

/**
 * Resolve a raw user name to a user ID.
 * Tries exact match (case-insensitive), then prefix match.
 */
export function resolveUserName(
  raw: string,
  lookup: Map<string, string>,
): { userId: string | null; normalizedName: string } {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Exact match
  const exact = lookup.get(lower);
  if (exact) {
    return { userId: exact, normalizedName: trimmed };
  }

  // Prefix match (e.g., "Priya S" → "Priya")
  for (const [name, id] of lookup) {
    if (lower.startsWith(name) || name.startsWith(lower)) {
      return { userId: id, normalizedName: trimmed };
    }
  }

  return { userId: null, normalizedName: trimmed };
}

// ---------------------------------------------------------------------------
// Split type normalization
// ---------------------------------------------------------------------------

/**
 * Map raw split_type strings from the CSV to our enum values.
 *   - "equal" → EQUAL
 *   - "unequal" → EXACT
 *   - "percentage" → PERCENTAGE
 *   - "share" → SHARE
 *   - empty → null (flagged separately)
 */
export function normalizeSplitType(raw: string): SplitType | null {
  const lower = raw.trim().toLowerCase();

  switch (lower) {
    case "equal":
      return "EQUAL";
    case "unequal":
    case "exact":
      return "EXACT";
    case "percentage":
      return "PERCENTAGE";
    case "share":
      return "SHARE";
    case "":
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Split details parsing
// ---------------------------------------------------------------------------

/**
 * Parse the split_details column.
 *
 * Formats observed in the CSV:
 *   - "Rohan 700; Priya 400; Meera 400"    (EXACT amounts)
 *   - "Aisha 30%; Rohan 30%; Priya 30%"    (PERCENTAGE)
 *   - "Aisha 1; Rohan 2; Priya 1; Dev 2"   (SHARE ratios)
 *   - "Aisha 2; Rohan 1; Priya 1"          (SHARE ratios)
 */
export function parseSplitDetails(
  raw: string,
  userLookup: Map<string, string>,
): SplitDetail[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  const parts = raw.split(";").map((p) => p.trim()).filter(Boolean);
  const details: SplitDetail[] = [];

  for (const part of parts) {
    // Match "Name Value" or "Name Value%"
    const match = /^(.+?)\s+([\d.]+)(%?)$/.exec(part.trim());
    if (!match) {
      // Try to parse as just a name (no value)
      details.push({
        userName: part.trim(),
        userId: resolveUserName(part.trim(), userLookup).userId,
        value: null,
      });
      continue;
    }

    const name = match[1].trim();
    const numericValue = Number(match[2]);
    const isPercent = match[3] === "%";
    const { userId } = resolveUserName(name, userLookup);

    details.push({
      userName: name,
      userId,
      // For percentages, store the percentage value as-is (e.g., 30 for 30%)
      // For exact/share, store the raw numeric value
      value: Number.isFinite(numericValue) ? numericValue : null,
    });
  }

  return details;
}

// ---------------------------------------------------------------------------
// Settlement detection
// ---------------------------------------------------------------------------

/** Regex patterns that indicate a settlement rather than an expense. */
const SETTLEMENT_PATTERNS = [
  /\bpaid\b.*\bback\b/i,
  /\bsettlement\b/i,
  /\bsettle\b/i,
  /\bdeposit\s+share\b/i,
  /^(\w+)\s+paid\s+(\w+)(\s+\d+)?$/i,
];

/**
 * Detect if a description looks like a peer-to-peer settlement.
 */
export function isSettlementDescription(description: string): boolean {
  return SETTLEMENT_PATTERNS.some((pattern) => pattern.test(description.trim()));
}

// ---------------------------------------------------------------------------
// Split participant parsing
// ---------------------------------------------------------------------------

/**
 * Parse the split_with column (semicolon-separated user names).
 * Returns SplitDetail entries with userId resolved where possible.
 */
export function parseSplitWith(
  raw: string,
  userLookup: Map<string, string>,
): SplitDetail[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  return raw
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      const { userId } = resolveUserName(name, userLookup);
      return { userName: name, userId, value: null };
    });
}

// ---------------------------------------------------------------------------
// Full row normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a single raw CSV row into a ParsedExpenseRow.
 * Collects normalization-level anomalies (format issues, detected currencies).
 * Does NOT run cross-row checks (duplicates, membership) — those happen in detectors.
 */
export function normalizeRow(
  rowNumber: number,
  raw: RawCsvRow,
  policy: ImportPolicy,
  userLookup: Map<string, string>,
): ParsedExpenseRow {
  const anomalies: ImportAnomaly[] = [];

  // ── Date ──
  const date = normalizeDate(raw.date);
  if (raw.date.trim() && !date) {
    anomalies.push({
      code: "INVALID_DATE",
      severity: "ERROR",
      message: `Cannot parse date: "${raw.date}"`,
      details: { rawValue: raw.date },
    });
  }

  // ── Amount ──
  const amountResult = normalizeAmount(raw.amount);
  let amountInCents: number | null = null;
  let detectedCurrency: "INR" | "USD" | null = null;

  if (amountResult) {
    amountInCents = amountResult.cents;
    detectedCurrency = amountResult.detectedCurrency;
    anomalies.push(...amountResult.anomalies);
  }

  // ── Currency ──
  const rawCurrency = raw.currency.trim().toUpperCase();
  let currency: "INR" | "USD" | null = null;

  if (rawCurrency === "INR" || rawCurrency === "USD") {
    currency = rawCurrency;
  } else if (rawCurrency === "") {
    // Use detected currency from amount symbol, or default
    currency = detectedCurrency ?? null;
  } else {
    anomalies.push({
      code: "INVALID_CURRENCY",
      severity: "ERROR",
      message: `Unknown currency: "${raw.currency}"`,
      details: { rawValue: raw.currency },
    });
  }

  // ── Payer ──
  const paidByName = raw.paid_by.trim();
  const paidByResolution = paidByName
    ? resolveUserName(paidByName, userLookup)
    : { userId: null, normalizedName: "" };

  // ── Split type ──
  const splitType = normalizeSplitType(raw.split_type);
  if (raw.split_type.trim() && !splitType) {
    anomalies.push({
      code: "INVALID_SPLIT_TYPE",
      severity: "WARNING",
      message: `Unknown split type: "${raw.split_type}"`,
      details: { rawValue: raw.split_type },
    });
  }

  // ── Split participants & details ──
  const splitWith = parseSplitWith(raw.split_with, userLookup);
  const splitDetails = parseSplitDetails(raw.split_details, userLookup);

  // Merge split details into split_with entries by matching names
  if (splitDetails.length > 0) {
    for (const detail of splitDetails) {
      const existing = splitWith.find(
        (sw) => sw.userName.toLowerCase() === detail.userName.toLowerCase(),
      );
      if (existing) {
        existing.value = detail.value;
        existing.userId = existing.userId ?? detail.userId;
      }
    }
  }

  // ── Settlement detection ──
  const isSettlement = isSettlementDescription(raw.description);

  return {
    rowNumber,
    raw,
    date,
    description: raw.description.trim(),
    paidByName: paidByResolution.normalizedName,
    paidByUserId: paidByResolution.userId,
    amountInCents,
    currency,
    splitType,
    rawSplitType: raw.split_type.trim(),
    splitWith,
    isSettlement,
    normalizationAnomalies: anomalies,
  };
}
