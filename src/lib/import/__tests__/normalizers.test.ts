import { describe, it, expect } from "vitest";
import {
  normalizeAmount,
  normalizeDate,
  normalizeSplitType,
  isSettlementDescription,
  resolveUserName,
  parseSplitDetails,
  parseSplitWith,
} from "../normalizers";

// ---------------------------------------------------------------------------
// normalizeAmount
// ---------------------------------------------------------------------------

describe("normalizeAmount", () => {
  it("handles plain integer", () => {
    const result = normalizeAmount("100");
    expect(result?.cents).toBe(10000);
    expect(result?.wasNormalized).toBe(false);
    expect(result?.detectedCurrency).toBeNull();
  });

  it("handles comma in amount", () => {
    const result = normalizeAmount("1,200");
    expect(result?.cents).toBe(120000);
    expect(result?.wasNormalized).toBe(true);
  });

  it("handles currency symbol $", () => {
    const result = normalizeAmount("$120");
    expect(result?.cents).toBe(12000);
    expect(result?.detectedCurrency).toBe("USD");
    expect(result?.wasNormalized).toBe(true);
  });

  it("handles currency symbol ₹", () => {
    const result = normalizeAmount("₹1500");
    expect(result?.cents).toBe(150000);
    expect(result?.detectedCurrency).toBe("INR");
  });

  it("handles trailing /- notation", () => {
    const result = normalizeAmount("2300/-");
    expect(result?.cents).toBe(230000);
    expect(result?.wasNormalized).toBe(true);
  });

  it("handles whitespace", () => {
    const result = normalizeAmount("  500  ");
    expect(result?.cents).toBe(50000);
  });

  it("returns null for empty string", () => {
    expect(normalizeAmount("")).toBeNull();
    expect(normalizeAmount("   ")).toBeNull();
  });

  it("rounds amounts with more than 2 decimal places", () => {
    const result = normalizeAmount("899.995");
    expect(result?.cents).toBe(90000);
    expect(result?.anomalies).toHaveLength(1);
    expect(result?.anomalies[0].code).toBe("NUMBER_FORMAT_NORMALIZED");
  });

  it("handles decimal amounts normally", () => {
    const result = normalizeAmount("1500.50");
    expect(result?.cents).toBe(150050);
  });
});

// ---------------------------------------------------------------------------
// normalizeDate
// ---------------------------------------------------------------------------

describe("normalizeDate", () => {
  it("parses DD-MM-YYYY format", () => {
    const result = normalizeDate("01-02-2026");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(1); // February = 1
    expect(result!.getDate()).toBe(1);
  });

  it("parses DD/MM/YYYY format", () => {
    const result = normalizeDate("15/03/2026");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(2); // March = 2
    expect(result!.getDate()).toBe(15);
  });

  it("parses YYYY-MM-DD (ISO) format", () => {
    const result = normalizeDate("2026-04-01");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(3); // April = 3
    expect(result!.getDate()).toBe(1);
  });

  it("returns null for unparseable date", () => {
    expect(normalizeDate("Mar-14")).toBeNull();
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate("not-a-date")).toBeNull();
  });

  it("handles whitespace", () => {
    const result = normalizeDate("  01-02-2026  ");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// normalizeSplitType
// ---------------------------------------------------------------------------

describe("normalizeSplitType", () => {
  it.each([
    ["equal", "EQUAL"],
    ["EQUAL", "EQUAL"],
    ["unequal", "EXACT"],
    ["exact", "EXACT"],
    ["percentage", "PERCENTAGE"],
    ["PERCENTAGE", "PERCENTAGE"],
    ["share", "SHARE"],
    ["SHARE", "SHARE"],
  ])("maps '%s' to '%s'", (input, expected) => {
    expect(normalizeSplitType(input)).toBe(expected);
  });

  it("returns null for unknown types", () => {
    expect(normalizeSplitType("random")).toBeNull();
    expect(normalizeSplitType("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isSettlementDescription
// ---------------------------------------------------------------------------

describe("isSettlementDescription", () => {
  it("detects 'paid back' patterns", () => {
    expect(isSettlementDescription("Rohan paid Aisha back")).toBe(true);
    expect(isSettlementDescription("Aisha paid back Rohan")).toBe(true);
  });

  it("detects 'settlement' or 'settle'", () => {
    expect(isSettlementDescription("Settlement for electricity")).toBe(true);
    expect(isSettlementDescription("Settle debt")).toBe(true);
  });

  it("detects 'deposit share'", () => {
    expect(isSettlementDescription("Sam deposit share")).toBe(true);
  });

  it("detects 'Name paid Name Amount' patterns", () => {
    expect(isSettlementDescription("Rohan paid Aisha 2000")).toBe(true);
    expect(isSettlementDescription("Rohan paid Aisha")).toBe(true);
  });

  it("returns false for normal expenses", () => {
    expect(isSettlementDescription("Groceries at DMart")).toBe(false);
    expect(isSettlementDescription("Dinner at restaurant")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveUserName
// ---------------------------------------------------------------------------

describe("resolveUserName", () => {
  const lookup = new Map([
    ["aisha", "user-1"],
    ["rohan", "user-2"],
    ["priya", "user-3"],
    ["meera", "user-4"],
    ["sam", "user-5"],
  ]);

  it("resolves exact match case-insensitively", () => {
    expect(resolveUserName("Aisha", lookup)).toEqual({
      userId: "user-1",
      normalizedName: "Aisha",
    });
  });

  it("resolves prefix match (e.g., 'Priya S' → 'Priya')", () => {
    const result = resolveUserName("Priya S", lookup);
    expect(result.userId).toBe("user-3");
  });

  it("returns null for unknown user", () => {
    const result = resolveUserName("Dev", lookup);
    expect(result.userId).toBeNull();
    expect(result.normalizedName).toBe("Dev");
  });

  it("resolves with whitespace", () => {
    expect(resolveUserName("  Rohan  ", lookup).userId).toBe("user-2");
  });
});

// ---------------------------------------------------------------------------
// parseSplitDetails
// ---------------------------------------------------------------------------

describe("parseSplitDetails", () => {
  const lookup = new Map([
    ["aisha", "user-1"],
    ["rohan", "user-2"],
    ["priya", "user-3"],
    ["meera", "user-4"],
  ]);

  it("parses EXACT amounts", () => {
    const result = parseSplitDetails(
      "Rohan 700; Priya 400; Meera 400",
      lookup,
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ userName: "Rohan", userId: "user-2", value: 700 });
    expect(result[1]).toMatchObject({ userName: "Priya", userId: "user-3", value: 400 });
  });

  it("parses PERCENTAGE amounts", () => {
    const result = parseSplitDetails(
      "Aisha 30%; Rohan 30%; Priya 40%",
      lookup,
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ userName: "Aisha", userId: "user-1", value: 30 });
    expect(result[2]).toMatchObject({ userName: "Priya", userId: "user-3", value: 40 });
  });

  it("parses SHARE ratios", () => {
    const result = parseSplitDetails(
      "Aisha 1; Rohan 2; Priya 1; Meera 2",
      lookup,
    );
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ userName: "Aisha", value: 1 });
    expect(result[1]).toMatchObject({ userName: "Rohan", value: 2 });
  });

  it("returns empty array for empty input", () => {
    expect(parseSplitDetails("", lookup)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseSplitWith
// ---------------------------------------------------------------------------

describe("parseSplitWith", () => {
  const lookup = new Map([
    ["aisha", "user-1"],
    ["rohan", "user-2"],
  ]);

  it("parses semicolon-separated names", () => {
    const result = parseSplitWith("Aisha; Rohan", lookup);
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user-1");
    expect(result[1].userId).toBe("user-2");
  });

  it("resolves unknown names to null userId", () => {
    const result = parseSplitWith("Aisha; Dev; Rohan", lookup);
    expect(result[1].userId).toBeNull();
    expect(result[1].userName).toBe("Dev");
  });

  it("returns empty array for empty input", () => {
    expect(parseSplitWith("", lookup)).toEqual([]);
  });
});
