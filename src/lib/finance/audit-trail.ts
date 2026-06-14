/**
 * Audit Trail Builder
 *
 * Produces a chronological, per-user breakdown of every expense that
 * affected their balance, with a running total.
 *
 * This satisfies "Rohan's Requirement": trace every cent from original
 * expense to final settlement, with zero unexplained magic numbers.
 */

export interface AuditEntry {
  expenseId: string;
  description: string;
  date: Date;
  currency: string;
  exchangeRateToInr: string;
  /** PAYER = user paid the expense. PARTICIPANT = user owes a share. */
  role: "PAYER" | "PARTICIPANT";
  /** The raw amount impact in original currency cents. */
  rawAmountInCents: number;
  /** The amount impact converted to INR paise. Positive = credit, negative = debit. */
  amountInPaiseInr: number;
  /** Running balance after this entry (INR paise). */
  runningBalanceInPaise: number;
}

export interface ExpenseForAudit {
  id: string;
  description: string;
  date: Date;
  currency: string;
  exchangeRateToInr: string;
  amountInCents: number;
  paidByUserId: string;
  isSettlement: boolean;
  splits: Array<{
    userId: string;
    owedAmountInCents: number;
  }>;
}

/**
 * Convert an amount to INR paise using the exchange rate string.
 * Mirrors the logic in balance-calculator.ts.
 */
function toInrPaise(amountInCents: number, exchangeRate: string): number {
  if (exchangeRate === "1" || exchangeRate === "1.0") {
    return amountInCents;
  }

  const parts = exchangeRate.split(".");
  const intPart = parts[0];
  const fracPart = parts[1] ?? "";
  const numerator = BigInt(`${intPart}${fracPart}`);
  const denominator = 10n ** BigInt(fracPart.length);

  return Number((BigInt(amountInCents) * numerator) / denominator);
}

/**
 * Build a complete audit trail for a specific user.
 *
 * Each expense where the user is either payer or participant generates
 * an entry. The running balance is accumulated chronologically.
 *
 * @param expenses  All expenses in the group, sorted by date
 * @param userId    The user whose audit trail to build
 * @returns         Chronological array of audit entries with running balance
 */
export function buildAuditTrail(
  expenses: ExpenseForAudit[],
  userId: string,
): AuditEntry[] {
  const entries: AuditEntry[] = [];
  let runningBalance = 0;

  // Sort by date, then by creation order (id as tiebreaker)
  const sorted = [...expenses].sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  for (const expense of sorted) {
    const isPayer = expense.paidByUserId === userId;
    const split = expense.splits.find((s) => s.userId === userId);

    if (!isPayer && !split) continue; // User not involved in this expense

    // If user is the payer, they get a CREDIT of the full amount
    if (isPayer) {
      const creditPaise = toInrPaise(expense.amountInCents, expense.exchangeRateToInr);
      runningBalance += creditPaise;

      entries.push({
        expenseId: expense.id,
        description: expense.description,
        date: expense.date,
        currency: expense.currency,
        exchangeRateToInr: expense.exchangeRateToInr,
        role: "PAYER",
        rawAmountInCents: expense.amountInCents,
        amountInPaiseInr: creditPaise,
        runningBalanceInPaise: runningBalance,
      });
    }

    // If user is a participant, they get a DEBIT of their owed share
    if (split) {
      const debitPaise = toInrPaise(split.owedAmountInCents, expense.exchangeRateToInr);
      runningBalance -= debitPaise;

      entries.push({
        expenseId: expense.id,
        description: expense.description,
        date: expense.date,
        currency: expense.currency,
        exchangeRateToInr: expense.exchangeRateToInr,
        role: "PARTICIPANT",
        rawAmountInCents: -split.owedAmountInCents,
        amountInPaiseInr: -debitPaise,
        runningBalanceInPaise: runningBalance,
      });
    }
  }

  return entries;
}
