import Papa from "papaparse";
import type { RawCsvRow, ImportAnomaly } from "./types";
import { CSV_HEADERS } from "./types";

/**
 * Result of CSV parsing — separates clean data rows from structural anomalies.
 */
export interface CsvParseResult {
  rows: Array<{ rowNumber: number; data: RawCsvRow }>;
  malformedAnomalies: Array<ImportAnomaly & { rowNumber: number }>;
}

/**
 * Parse a raw CSV string into structured rows using PapaParse.
 *
 * Handles:
 * - BOM stripping
 * - Unclosed quotes / malformed rows (caught as MALFORMED_CSV_ROW anomalies)
 * - Whitespace trimming on headers and values
 * - Wrong column count detection
 *
 * Never throws — all errors are captured as anomalies.
 */
export function parseCsvContent(csvContent: string): CsvParseResult {
  const rows: CsvParseResult["rows"] = [];
  const malformedAnomalies: CsvParseResult["malformedAnomalies"] = [];

  // Strip BOM if present
  const cleaned = csvContent.replace(/^\uFEFF/, "");

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string) => header.trim().toLowerCase(),
    transform: (value: string) => value.trim(),
  });

  // Check if headers match expected columns
  const actualHeaders = result.meta.fields ?? [];
  const missingHeaders = CSV_HEADERS.filter(
    (h) => !actualHeaders.includes(h),
  );

  if (missingHeaders.length > 0) {
    malformedAnomalies.push({
      rowNumber: 0,
      code: "MALFORMED_CSV_ROW",
      severity: "ERROR",
      message: `CSV is missing expected column headers: ${missingHeaders.join(", ")}`,
      details: {
        expectedHeaders: CSV_HEADERS.join(", "),
        actualHeaders: actualHeaders.join(", "),
      },
    });
  }

  // Process PapaParse-level errors (e.g., unclosed quotes, wrong field count)
  for (const error of result.errors) {
    malformedAnomalies.push({
      // PapaParse row index is 0-based (data rows), add 2 for header + 1-based
      rowNumber: (error.row ?? -1) + 2,
      code: "MALFORMED_CSV_ROW",
      severity: "ERROR",
      message: `CSV parse error: ${error.message}`,
      details: {
        type: error.type,
        code: error.code,
        row: error.row ?? -1,
      },
    });
  }

  // Map parsed data to typed rows
  for (let i = 0; i < result.data.length; i++) {
    const raw = result.data[i];
    // Row number is 1-based, +1 for the header row
    const rowNumber = i + 2;

    const row: RawCsvRow = {
      date: raw["date"] ?? "",
      description: raw["description"] ?? "",
      paid_by: raw["paid_by"] ?? "",
      amount: raw["amount"] ?? "",
      currency: raw["currency"] ?? "",
      split_type: raw["split_type"] ?? "",
      split_with: raw["split_with"] ?? "",
      split_details: raw["split_details"] ?? "",
      notes: raw["notes"] ?? "",
    };

    rows.push({ rowNumber, data: row });
  }

  return { rows, malformedAnomalies };
}
