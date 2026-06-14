/**
 * Balance Calculator
 *
 * Computes net balances from raw expense + split data.
 * For each expense:
 *   - The payer gets CREDIT of +amountInCents
 *   - Each split participant gets DEBIT of -owedAmountInCents
 *
 * Net balance = sum of all credits - sum of all debits per user.
 * Positive balance = user is owed money.
 * Negative balance = user owes money.
 *
 * Multi-currency handling: amounts are converted to INR paise using
 * the exchange rate stored on each expense.
 */

import type { NetBalance } from "./debt-simplifier";

export interface ExpenseForBalance {
  amountInCents: number;
  currency: string;
  /** Decimal string, e.g. "83" for 1 USD = 83 INR. */
  exchangeRateToInr: string;
  paidByUserId: string;
  isSettlement: boolean;
  splits: Array<{
    userId: string;
    owedAmountInCents: number;
  }>;
}

/**
 * Convert an amount in its original currency to INR paise.
 * Uses integer-safe multiplication.
 */
function toInrPaise(amountInCents: number, exchangeRate: string): number {
  if (exchangeRate === "1" || exchangeRate === "1.0") {
    return amountInCents; // Already INR
  }

  // Parse exchange rate as a rational number to avoid float errors.
  // E.g., "83" → 83/1, "83.5" → 835/10
  const parts = exchangeRate.split(".");
  const intPart = parts[0];
  const fracPart = parts[1] ?? "";
  const numerator = BigInt(`${intPart}${fracPart}`);
  const denominator = 10n ** BigInt(fracPart.length);

  const result = (BigInt(amountInCents) * numerator) / denominator;
  return Number(result);
}

/**
 * Calculate net balances for all users involved in the given expenses.
 *
 * @param expenses  Array of expenses with their splits
 * @returns         Array of {userId, balanceInCents} in INR paise
 */
export function calculateNetBalances(
  expenses: ExpenseForBalance[],
): NetBalance[] {
  const balanceMap = new Map<string, number>();

  function addToBalance(userId: string, amount: number): void {
    const current = balanceMap.get(userId) ?? 0;
    balanceMap.set(userId, current + amount);
  }

  for (const expense of expenses) {
    const rate = expense.exchangeRateToInr;

    // The payer is CREDITED the full amount (they paid, so they're owed)
    const payerCreditInPaise = toInrPaise(expense.amountInCents, rate);
    addToBalance(expense.paidByUserId, payerCreditInPaise);

    // Each participant is DEBITED their owed share
    for (const split of expense.splits) {
      const debitInPaise = toInrPaise(split.owedAmountInCents, rate);
      addToBalance(split.userId, -debitInPaise);
    }
  }

  return Array.from(balanceMap.entries()).map(([userId, balanceInCents]) => ({
    userId,
    balanceInCents,
  }));
}
