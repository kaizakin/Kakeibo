/**
 * Debt Simplification Algorithm
 *
 * Takes net balances for all users and computes the minimum set of
 * peer-to-peer transfers to settle all debts.
 *
 * Uses a greedy approach: repeatedly match the largest creditor with
 * the largest debtor, transferring the smaller of the two absolute values.
 *
 * ALL arithmetic uses integer cents/paise — zero floating-point math.
 */

export interface NetBalance {
  userId: string;
  /** Positive = this user is owed money (creditor). Negative = this user owes money (debtor). */
  balanceInCents: number;
}

export interface SimplifiedTransfer {
  fromUserId: string;
  toUserId: string;
  amountInCents: number;
}

/**
 * Minimize the number of transfers needed to settle all debts.
 *
 * Invariant: sum of all balances must be zero (or very close due to rounding).
 * If it's not, the function will still produce valid transfers for the
 * balanced portion of the debts.
 *
 * @param balances  Array of {userId, balanceInCents} — positive = creditor, negative = debtor
 * @returns         Minimum array of peer-to-peer transfers
 */
export function minimizeDebts(balances: NetBalance[]): SimplifiedTransfer[] {
  // Filter out zero balances — they don't need any transfers
  const nonZero = balances
    .filter((b) => b.balanceInCents !== 0)
    .map((b) => ({ ...b })); // Clone to avoid mutating input

  const transfers: SimplifiedTransfer[] = [];

  // Separate into creditors (positive) and debtors (negative)
  // Use a greedy loop: sort both sides by absolute value descending,
  // then match largest with largest.
  while (true) {
    // Split into creditors and debtors
    const creditors = nonZero
      .filter((b) => b.balanceInCents > 0)
      .sort((a, b) => b.balanceInCents - a.balanceInCents); // Largest first

    const debtors = nonZero
      .filter((b) => b.balanceInCents < 0)
      .sort((a, b) => a.balanceInCents - b.balanceInCents); // Most negative first

    if (creditors.length === 0 || debtors.length === 0) {
      break; // All debts settled
    }

    const topCreditor = creditors[0];
    const topDebtor = debtors[0];

    // Transfer amount = min of what's owed to creditor and what debtor owes
    const transferAmount = Math.min(
      topCreditor.balanceInCents,
      Math.abs(topDebtor.balanceInCents),
    );

    if (transferAmount <= 0) break; // Safety check

    transfers.push({
      fromUserId: topDebtor.userId,
      toUserId: topCreditor.userId,
      amountInCents: transferAmount,
    });

    // Update balances in the working array
    const creditorEntry = nonZero.find((b) => b.userId === topCreditor.userId)!;
    const debtorEntry = nonZero.find((b) => b.userId === topDebtor.userId)!;
    creditorEntry.balanceInCents -= transferAmount;
    debtorEntry.balanceInCents += transferAmount;

    // Remove zeroed-out entries
    const zeroIdx = nonZero.findIndex((b) => b.balanceInCents === 0);
    if (zeroIdx !== -1) {
      nonZero.splice(zeroIdx, 1);
    }
  }

  return transfers;
}
