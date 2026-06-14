import { describe, it, expect } from "vitest";
import { runImportPipeline } from "../pipeline";
import type { ImportPolicy } from "../types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// CSV fixture content
// ---------------------------------------------------------------------------

const FIXTURE_CSV = readFileSync(
  resolve(__dirname, "../../../../fixtures/expenses_export.csv"),
  "utf-8",
);

// The actual expenses_report.csv from the project root
const ACTUAL_CSV = readFileSync(
  resolve(__dirname, "../../../../expenses_report.csv"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Test policy
// ---------------------------------------------------------------------------

function makePolicy(overrides?: Partial<ImportPolicy>): ImportPolicy {
  return {
    now: new Date("2026-05-01T00:00:00Z"),
    users: [
      { id: "uid-aisha", name: "Aisha", email: "aisha@example.com" },
      { id: "uid-rohan", name: "Rohan", email: "rohan@example.com" },
      { id: "uid-priya", name: "Priya", email: "priya@example.com" },
      { id: "uid-meera", name: "Meera", email: "meera@example.com" },
      { id: "uid-sam", name: "Sam", email: "sam@example.com" },
    ],
    memberships: [
      { userId: "uid-aisha", joinedAt: "2026-01-01T00:00:00+05:30", leftAt: null },
      { userId: "uid-rohan", joinedAt: "2026-01-01T00:00:00+05:30", leftAt: null },
      { userId: "uid-priya", joinedAt: "2026-01-01T00:00:00+05:30", leftAt: null },
      { userId: "uid-meera", joinedAt: "2026-01-01T00:00:00+05:30", leftAt: "2026-03-31T23:59:59+05:30" },
      { userId: "uid-sam", joinedAt: "2026-04-08T00:00:00+05:30", leftAt: null },
    ],
    defaultCurrency: "INR" as const,
    usdToInrRate: "83",
    groupId: "test-group",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pipeline integration tests — fixture CSV
// ---------------------------------------------------------------------------

describe("runImportPipeline — fixture CSV", () => {
  const policy = makePolicy({ now: new Date("2026-04-30T00:00:00+05:30") });
  const report = runImportPipeline(FIXTURE_CSV, policy);

  it("parses all rows", () => {
    expect(report.totalRows).toBeGreaterThan(0);
  });

  it("detects currency ambiguity (USD row)", () => {
    const usdAnomalies = report.anomalies.filter(
      (a) => a.code === "CURRENCY_AMBIGUITY",
    );
    expect(usdAnomalies.length).toBeGreaterThanOrEqual(1);
  });

  it("detects membership violations (Meera after Mar 31)", () => {
    const violations = report.anomalies.filter(
      (a) => a.code === "MEMBERSHIP_VIOLATION",
    );
    expect(violations.length).toBeGreaterThanOrEqual(1);
    const meeraViolations = violations.filter(
      (a) => a.details?.userName === "Meera" || a.message.includes("Meera"),
    );
    expect(meeraViolations.length).toBeGreaterThanOrEqual(1);
  });

  it("detects exact duplicates", () => {
    const duplicates = report.anomalies.filter(
      (a) => a.code === "DUPLICATE",
    );
    expect(duplicates.length).toBeGreaterThanOrEqual(1);
  });

  it("detects conflicting duplicates", () => {
    const conflicting = report.anomalies.filter(
      (a) => a.code === "CONFLICTING_DUPLICATE",
    );
    expect(conflicting.length).toBeGreaterThanOrEqual(1);
  });

  it("detects settlement misclassification", () => {
    const settlements = report.anomalies.filter(
      (a) => a.code === "SETTLEMENT_MISCLASSIFICATION",
    );
    expect(settlements.length).toBeGreaterThanOrEqual(1);
  });

  it("detects negative amounts", () => {
    const negatives = report.anomalies.filter(
      (a) => a.code === "NEGATIVE_AMOUNT",
    );
    expect(negatives.length).toBeGreaterThanOrEqual(1);
  });

  it("detects number format issues", () => {
    const formatIssues = report.anomalies.filter(
      (a) => a.code === "NUMBER_FORMAT_NORMALIZED",
    );
    expect(formatIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("detects missing fields", () => {
    const missing = report.anomalies.filter(
      (a) => a.code === "MISSING_CRITICAL_FIELD",
    );
    expect(missing.length).toBeGreaterThanOrEqual(1);
  });

  it("detects invalid split math", () => {
    const splitMath = report.anomalies.filter(
      (a) => a.code === "INVALID_SPLIT_MATH",
    );
    expect(splitMath.length).toBeGreaterThanOrEqual(1);
  });

  it("detects unknown guest users", () => {
    const unknown = report.anomalies.filter(
      (a) => a.code === "UNKNOWN_GUEST_USER",
    );
    expect(unknown.length).toBeGreaterThanOrEqual(1);
  });

  it("detects zero-value transactions", () => {
    const zero = report.anomalies.filter(
      (a) => a.code === "ZERO_VALUE_TRANSACTION",
    );
    expect(zero.length).toBeGreaterThanOrEqual(1);
  });

  it("detects future-dated records", () => {
    const future = report.anomalies.filter(
      (a) => a.code === "FUTURE_DATED_RECORD",
    );
    expect(future.length).toBeGreaterThanOrEqual(1);
  });

  it("produces clean records for rows without errors", () => {
    expect(report.cleanCount).toBeGreaterThan(0);
    expect(report.cleanRecords.length).toBe(report.cleanCount);
  });
});

// ---------------------------------------------------------------------------
// Pipeline integration tests — actual expenses_report.csv
// ---------------------------------------------------------------------------

describe("runImportPipeline — actual expenses_report.csv", () => {
  const policy = makePolicy({ now: new Date("2026-04-30T00:00:00+05:30") });
  const report = runImportPipeline(ACTUAL_CSV, policy);

  it("parses data rows from the actual CSV", () => {
    expect(report.totalRows).toBeGreaterThan(40);
  });

  it("detects expected anomaly types from the real CSV", () => {
    const anomalyCodes = new Set(report.anomalies.map((a) => a.code));

    // Anomalies present in expenses_report.csv
    expect(anomalyCodes.has("CURRENCY_AMBIGUITY")).toBe(true);
    expect(anomalyCodes.has("MEMBERSHIP_VIOLATION")).toBe(true);
    expect(anomalyCodes.has("SETTLEMENT_MISCLASSIFICATION")).toBe(true);
    expect(anomalyCodes.has("NEGATIVE_AMOUNT")).toBe(true);
    expect(anomalyCodes.has("NUMBER_FORMAT_NORMALIZED")).toBe(true);
    expect(anomalyCodes.has("MISSING_CRITICAL_FIELD")).toBe(true);
    expect(anomalyCodes.has("INVALID_SPLIT_MATH")).toBe(true);
    expect(anomalyCodes.has("UNKNOWN_GUEST_USER")).toBe(true);
    expect(anomalyCodes.has("ZERO_VALUE_TRANSACTION")).toBe(true);
    expect(anomalyCodes.has("FUTURE_DATED_RECORD")).toBe(true);
    expect(anomalyCodes.has("INVALID_DATE")).toBe(true);
    expect(anomalyCodes.has("CONFLICTING_DUPLICATE")).toBe(true);
  });

  it("reports review and clean counts", () => {
    expect(report.reviewCount).toBeGreaterThan(0);
    expect(report.cleanCount).toBeGreaterThan(0);
  });
});
