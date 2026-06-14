import { describe, it, expect } from "vitest";
import {
  divideWithRemainder,
  convertMinorUnits,
  parseDecimalRate,
  toDatabaseInt,
  assertIntegerMinorUnits,
  INR_RATE,
  USD_TO_INR_RATE,
} from "../money";

describe("divideWithRemainder", () => {
  it("splits evenly when divisible", () => {
    const result = divideWithRemainder(100n, ["a", "b", "c", "d", "e"]);
    expect(Array.from(result.values())).toEqual([20n, 20n, 20n, 20n, 20n]);
  });

  it("distributes remainder to first participants", () => {
    const result = divideWithRemainder(103n, ["a", "b", "c"]);
    expect(result.get("a")).toBe(35n);
    expect(result.get("b")).toBe(34n);
    expect(result.get("c")).toBe(34n);
  });

  it("handles single participant", () => {
    const result = divideWithRemainder(100n, ["a"]);
    expect(result.get("a")).toBe(100n);
  });

  it("throws on negative total", () => {
    expect(() => divideWithRemainder(-1n, ["a"])).toThrow("Cannot split a negative total");
  });

  it("throws on empty participants", () => {
    expect(() => divideWithRemainder(100n, [])).toThrow("At least one participant");
  });

  it("handles large values", () => {
    const total = 1_000_000_000_000n;
    const result = divideWithRemainder(total, ["a", "b", "c"]);
    const sum = Array.from(result.values()).reduce((a, b) => a + b, 0n);
    expect(sum).toBe(total);
  });
});

describe("convertMinorUnits", () => {
  it("returns same value for 1:1 rate", () => {
    expect(convertMinorUnits(100n, INR_RATE)).toBe(100n);
  });

  it("converts USD to INR at 83 rate", () => {
    expect(convertMinorUnits(100n, USD_TO_INR_RATE)).toBe(8300n);
  });

  it("rounds half away from zero", () => {
    const rate = parseDecimalRate("2.5");
    expect(convertMinorUnits(3n, rate)).toBe(8n); // 3 * 2.5 = 7.5 → 8
  });

  it("handles integer division exactly", () => {
    const rate = parseDecimalRate("0.5");
    expect(convertMinorUnits(100n, rate)).toBe(50n);
  });

  it("throws on zero rate", () => {
    expect(() =>
      convertMinorUnits(100n, { numerator: 0n, denominator: 1n }),
    ).toThrow("Exchange rates must be positive");
  });
});

describe("parseDecimalRate", () => {
  it("parses integer rate", () => {
    const rate = parseDecimalRate("83");
    expect(rate.numerator).toBe(83n);
    expect(rate.denominator).toBe(1n);
  });

  it("parses decimal rate", () => {
    const rate = parseDecimalRate("83.5");
    expect(rate.numerator).toBe(835n);
    expect(rate.denominator).toBe(10n);
  });

  it("throws on invalid format", () => {
    expect(() => parseDecimalRate("abc")).toThrow("Invalid");
    expect(() => parseDecimalRate("-1")).toThrow("Invalid");
    expect(() => parseDecimalRate("")).toThrow("Invalid");
  });
});

describe("toDatabaseInt", () => {
  it("converts safe bigint to number", () => {
    expect(toDatabaseInt(100n)).toBe(100);
  });

  it("throws on values exceeding PostgreSQL integer range", () => {
    expect(() => toDatabaseInt(3_000_000_000n)).toThrow("exceeds");
    expect(() => toDatabaseInt(-3_000_000_000n)).toThrow("exceeds");
  });
});

describe("assertIntegerMinorUnits", () => {
  it("accepts safe integers", () => {
    expect(() => assertIntegerMinorUnits(123)).not.toThrow();
    expect(() => assertIntegerMinorUnits(0)).not.toThrow();
    expect(() => assertIntegerMinorUnits(-50)).not.toThrow();
  });

  it("rejects floats", () => {
    expect(() => assertIntegerMinorUnits(100.5)).toThrow("Money values");
  });
});
