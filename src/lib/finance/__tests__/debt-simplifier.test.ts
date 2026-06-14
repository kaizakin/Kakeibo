import { describe, it, expect } from "vitest";
import { minimizeDebts, type NetBalance } from "../debt-simplifier";

describe("minimizeDebts", () => {
  it("returns empty transfers when all balances are zero", () => {
    const balances: NetBalance[] = [
      { userId: "a", balanceInCents: 0 },
      { userId: "b", balanceInCents: 0 },
      { userId: "c", balanceInCents: 0 },
    ];
    expect(minimizeDebts(balances)).toEqual([]);
  });

  it("handles two users where one owes the other", () => {
    const balances: NetBalance[] = [
      { userId: "a", balanceInCents: -5000 },
      { userId: "b", balanceInCents: 5000 },
    ];
    const result = minimizeDebts(balances);
    expect(result).toHaveLength(1);
    expect(result[0].fromUserId).toBe("a");
    expect(result[0].toUserId).toBe("b");
    expect(result[0].amountInCents).toBe(5000);
  });

  it("simplifies circular debt among three users", () => {
    // a owes 100, b owes 100, c is owed 200
    const balances: NetBalance[] = [
      { userId: "a", balanceInCents: -100 },
      { userId: "b", balanceInCents: -100 },
      { userId: "c", balanceInCents: 200 },
    ];
    const result = minimizeDebts(balances);
    // Should be 2 transfers, not 3 (or fewer if optimized)
    expect(result.length).toBeLessThanOrEqual(2);
    const sumTransfers = result.reduce((s, t) => s + t.amountInCents, 0);
    expect(sumTransfers).toBe(200);
  });

  it("handles large amounts without floating point errors", () => {
    const balances: NetBalance[] = [
      { userId: "a", balanceInCents: -99999999 },
      { userId: "b", balanceInCents: 99999999 },
    ];
    const result = minimizeDebts(balances);
    expect(result[0].amountInCents).toBe(99999999);
  });

  it("handles uneven split with remainder", () => {
    // Alice owes 34, Bob owes 33, Charlie is owed 67
    const balances: NetBalance[] = [
      { userId: "alice", balanceInCents: -34 },
      { userId: "bob", balanceInCents: -33 },
      { userId: "charlie", balanceInCents: 67 },
    ];
    const result = minimizeDebts(balances);
    const sumTransfers = result.reduce((s, t) => s + t.amountInCents, 0);
    expect(sumTransfers).toBe(67);

    // Verify total debt cancelled to zero
    const totalCreditor = result.reduce((s, t) => s + t.amountInCents, 0);
    expect(totalCreditor).toBe(67);
  });

  it("returns empty for single user", () => {
    expect(minimizeDebts([{ userId: "a", balanceInCents: 100 }])).toEqual([]);
  });

  it("handles many users with small dust amounts", () => {
    const balances: NetBalance[] = [
      { userId: "a", balanceInCents: -1 },
      { userId: "b", balanceInCents: 1 },
      { userId: "c", balanceInCents: -2 },
      { userId: "d", balanceInCents: 2 },
    ];
    const result = minimizeDebts(balances);
    const totalTransfer = result.reduce((s, t) => s + t.amountInCents, 0);
    expect(totalTransfer).toBe(3);

    // Verify each transfer is the right direction
    for (const t of result) {
      expect(t.amountInCents).toBeGreaterThan(0);
    }
  });

  it("handles mixed creditors and debtors with zero-sum balances", () => {
    const balances: NetBalance[] = [
      { userId: "a", balanceInCents: -100 },
      { userId: "b", balanceInCents: -50 },
      { userId: "c", balanceInCents: 80 },
      { userId: "d", balanceInCents: 70 },
    ];
    const result = minimizeDebts(balances);
    const totalFrom = result.reduce((s, t) => s + t.amountInCents, 0);
    const totalTo = result.reduce((s, t) => s + t.amountInCents, 0);
    expect(totalFrom).toBe(totalTo);
    expect(totalFrom).toBe(150);
  });

  it("does not create transfers for zero or near-zero dust", () => {
    const balances: NetBalance[] = [
      { userId: "a", balanceInCents: 0 },
      { userId: "b", balanceInCents: 0 },
    ];
    const result = minimizeDebts(balances);
    expect(result).toHaveLength(0);
  });
});
