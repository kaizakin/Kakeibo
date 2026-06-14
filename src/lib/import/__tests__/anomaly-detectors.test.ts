import { describe, it, expect } from "vitest";
import {
  detectCurrencyAmbiguity,
  detectMembershipViolation,
  detectDuplicates,
  detectSettlementMisclassification,
  detectNegativeAmount,
  detectMissingFields,
  detectInvalidSplitMath,
  detectUnknownUsers,
  detectZeroValue,
  detectFutureDated,
} from "../anomaly-detectors";
import type { ParsedExpenseRow, DetectorContext, ImportPolicy } from "../types";

// ---------------------------------------------------------------------------
// Helpers
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
      { userId: "uid-aisha", joinedAt: "2026-01-01", leftAt: null },
      { userId: "uid-rohan", joinedAt: "2026-01-01", leftAt: null },
      { userId: "uid-priya", joinedAt: "2026-01-01", leftAt: null },
      { userId: "uid-meera", joinedAt: "2026-01-01", leftAt: "2026-03-31" },
      { userId: "uid-sam", joinedAt: "2026-04-08", leftAt: null },
    ],
    defaultCurrency: "INR" as const,
    usdToInrRate: "83",
    groupId: "test-group",
    ...overrides,
  };
}

function makeRow(overrides?: Partial<ParsedExpenseRow>): ParsedExpenseRow {
  return {
    rowNumber: 1,
    raw: {
      date: "01-01-2026",
      description: "Test expense",
      paid_by: "Aisha",
      amount: "1000",
      currency: "INR",
      split_type: "equal",
      split_with: "Aisha;Rohan",
      split_details: "",
      notes: "",
    },
    date: new Date("2026-01-01"),
    description: "Test expense",
    paidByName: "Aisha",
    paidByUserId: "uid-aisha",
    amountInCents: 100000,
    currency: "INR",
    splitType: "EQUAL",
    rawSplitType: "equal",
    splitWith: [
      { userName: "Aisha", userId: "uid-aisha", value: null },
      { userName: "Rohan", userId: "uid-rohan", value: null },
    ],
    isSettlement: false,
    normalizationAnomalies: [],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<DetectorContext>): DetectorContext {
  return {
    policy: makePolicy(),
    allRows: [],
    userNameToId: new Map([
      ["aisha", "uid-aisha"],
      ["rohan", "uid-rohan"],
      ["priya", "uid-priya"],
      ["meera", "uid-meera"],
      ["sam", "uid-sam"],
    ]),
    membershipWindows: [
      { userId: "uid-aisha", joinedAt: new Date("2026-01-01"), leftAt: null },
      { userId: "uid-rohan", joinedAt: new Date("2026-01-01"), leftAt: null },
      { userId: "uid-priya", joinedAt: new Date("2026-01-01"), leftAt: null },
      { userId: "uid-meera", joinedAt: new Date("2026-01-01"), leftAt: new Date("2026-03-31") },
      { userId: "uid-sam", joinedAt: new Date("2026-04-08"), leftAt: null },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectCurrencyAmbiguity
// ---------------------------------------------------------------------------

describe("detectCurrencyAmbiguity", () => {
  it("flags USD rows", () => {
    const r = makeRow({ currency: "USD" });
    const result = detectCurrencyAmbiguity(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("CURRENCY_AMBIGUITY");
    expect(result[0].severity).toBe("WARNING");
  });

  it("does not flag INR rows", () => {
    const r = makeRow({ currency: "INR" });
    expect(detectCurrencyAmbiguity(r, makeContext())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectMembershipViolation
// ---------------------------------------------------------------------------

describe("detectMembershipViolation", () => {
  it("flags payer who was not active on expense date", () => {
    const r = makeRow({
      paidByName: "Meera",
      paidByUserId: "uid-meera",
      date: new Date("2026-04-02"),
    });
    const result = detectMembershipViolation(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("MEMBERSHIP_VIOLATION");
    expect(result[0].severity).toBe("ERROR");
  });

  it("flags participant who was not active on expense date", () => {
    const r = makeRow({
      splitWith: [
        { userName: "Aisha", userId: "uid-aisha", value: null },
        { userName: "Meera", userId: "uid-meera", value: null },
      ],
      date: new Date("2026-04-02"),
    });
    const result = detectMembershipViolation(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("MEMBERSHIP_VIOLATION");
  });

  it("does not flag active members", () => {
    const r = makeRow();
    const result = detectMembershipViolation(r, makeContext());
    expect(result).toHaveLength(0);
  });

  it("does not flag when date is null", () => {
    const r = makeRow({ date: null, paidByName: "", paidByUserId: null });
    expect(detectMembershipViolation(r, makeContext())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectDuplicates
// ---------------------------------------------------------------------------

describe("detectDuplicates", () => {
  it("detects exact duplicates", () => {
    const row1 = makeRow({ rowNumber: 1 });
    const row2 = makeRow({ rowNumber: 2 });
    const ctx = makeContext({ allRows: [row1, row2] });
    const result = detectDuplicates(row2, ctx);
    expect(result.some((a) => a.code === "DUPLICATE")).toBe(true);
  });

  it("detects conflicting duplicates", () => {
    const row1 = makeRow({
      rowNumber: 1,
      description: "Dinner at Thalassa",
      paidByName: "Aisha",
      paidByUserId: "uid-aisha",
      amountInCents: 240000,
    });
    const row2 = makeRow({
      rowNumber: 2,
      description: "Dinner at Thalassa",
      paidByName: "Rohan",
      paidByUserId: "uid-rohan",
      amountInCents: 245000,
    });
    const ctx = makeContext({ allRows: [row1, row2] });
    const result = detectDuplicates(row2, ctx);
    expect(result.some((a) => a.code === "CONFLICTING_DUPLICATE")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectSettlementMisclassification
// ---------------------------------------------------------------------------

describe("detectSettlementMisclassification", () => {
  it("flags rows marked as settlement", () => {
    const r = makeRow({ isSettlement: true });
    const result = detectSettlementMisclassification(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("SETTLEMENT_MISCLASSIFICATION");
  });

  it("does not flag regular expenses", () => {
    const r = makeRow();
    expect(detectSettlementMisclassification(r, makeContext())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectNegativeAmount
// ---------------------------------------------------------------------------

describe("detectNegativeAmount", () => {
  it("flags negative amounts", () => {
    const r = makeRow({ amountInCents: -50000 });
    const result = detectNegativeAmount(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("NEGATIVE_AMOUNT");
  });

  it("does not flag positive amounts", () => {
    const r = makeRow();
    expect(detectNegativeAmount(r, makeContext())).toHaveLength(0);
  });

  it("does not flag null amount", () => {
    expect(detectNegativeAmount(makeRow({ amountInCents: null }), makeContext())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectMissingFields
// ---------------------------------------------------------------------------

describe("detectMissingFields", () => {
  it("flags missing payer", () => {
    const r = makeRow({ paidByName: "", paidByUserId: null });
    const result = detectMissingFields(r, makeContext());
    expect(result.some((a) => a.code === "MISSING_CRITICAL_FIELD" && a.message.includes("payer"))).toBe(true);
  });

  it("flags missing amount", () => {
    const baseRaw = makeRow().raw;
    const r = makeRow({
      amountInCents: null,
      raw: { ...baseRaw, amount: "" },
    });
    const result = detectMissingFields(r, makeContext());
    expect(result.some((a) => a.code === "MISSING_CRITICAL_FIELD" && a.message.includes("amount"))).toBe(true);
  });

  it("flags missing currency", () => {
    const baseRaw = makeRow().raw;
    const r = makeRow({
      currency: null,
      raw: { ...baseRaw, currency: "" },
    });
    const result = detectMissingFields(r, makeContext());
    expect(result.some((a) => a.code === "MISSING_CRITICAL_FIELD" && a.message.includes("currency"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectInvalidSplitMath
// ---------------------------------------------------------------------------

describe("detectInvalidSplitMath", () => {
  it("flags percentage splits not summing to 100%", () => {
    const r = makeRow({
      splitType: "PERCENTAGE",
      splitWith: [
        { userName: "Aisha", userId: "uid-aisha", value: 30 },
        { userName: "Rohan", userId: "uid-rohan", value: 30 },
        { userName: "Priya", userId: "uid-priya", value: 35 },
      ],
    });
    const result = detectInvalidSplitMath(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("INVALID_SPLIT_MATH");
  });

  it("passes valid percentage splits", () => {
    const r = makeRow({
      splitType: "PERCENTAGE",
      splitWith: [
        { userName: "Aisha", userId: "uid-aisha", value: 30 },
        { userName: "Rohan", userId: "uid-rohan", value: 30 },
        { userName: "Priya", userId: "uid-priya", value: 40 },
      ],
    });
    expect(detectInvalidSplitMath(r, makeContext())).toHaveLength(0);
  });

  it("passes EXACT splits summing correctly", () => {
    const r = makeRow({
      splitType: "EXACT",
      amountInCents: 150000,
      splitWith: [
        { userName: "Rohan", userId: "uid-rohan", value: 700 },
        { userName: "Priya", userId: "uid-priya", value: 400 },
        { userName: "Meera", userId: "uid-meera", value: 400 },
      ],
    });
    expect(detectInvalidSplitMath(r, makeContext())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectUnknownUsers
// ---------------------------------------------------------------------------

describe("detectUnknownUsers", () => {
  it("flags unknown payer", () => {
    const r = makeRow({ paidByName: "Dev", paidByUserId: null });
    const result = detectUnknownUsers(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("UNKNOWN_GUEST_USER");
  });

  it("flags unknown participants", () => {
    const r = makeRow({
      splitWith: [
        { userName: "Aisha", userId: "uid-aisha", value: null },
        { userName: "Dev", userId: null, value: null },
      ],
    });
    const result = detectUnknownUsers(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("UNKNOWN_GUEST_USER");
  });
});

// ---------------------------------------------------------------------------
// detectZeroValue
// ---------------------------------------------------------------------------

describe("detectZeroValue", () => {
  it("flags zero amount", () => {
    const r = makeRow({ amountInCents: 0 });
    const result = detectZeroValue(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("ZERO_VALUE_TRANSACTION");
  });

  it("does not flag non-zero amounts", () => {
    const r = makeRow();
    expect(detectZeroValue(r, makeContext())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectFutureDated
// ---------------------------------------------------------------------------

describe("detectFutureDated", () => {
  it("flags future-dated rows", () => {
    const r = makeRow({ date: new Date("2099-01-01") });
    const result = detectFutureDated(r, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("FUTURE_DATED_RECORD");
  });

  it("does not flag past dates", () => {
    const r = makeRow();
    expect(detectFutureDated(r, makeContext())).toHaveLength(0);
  });
});
