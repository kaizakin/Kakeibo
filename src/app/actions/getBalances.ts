"use server";

import { db } from "@/src/lib/db";
import { calculateNetBalances, type ExpenseForBalance } from "@/src/lib/finance/balance-calculator";
import { minimizeDebts, type SimplifiedTransfer } from "@/src/lib/finance/debt-simplifier";
import { buildAuditTrail, type AuditEntry, type ExpenseForAudit } from "@/src/lib/finance/audit-trail";

// ---------------------------------------------------------------------------
// Get group balances
// ---------------------------------------------------------------------------

export interface GroupBalanceResult {
  balances: Array<{
    userId: string;
    userName: string;
    balanceInPaise: number;
  }>;
  totalExpenses: number;
}

export async function getGroupBalances(
  groupId: string,
): Promise<GroupBalanceResult> {
  const expenses = await db.expense.findMany({
    where: { groupId },
    include: {
      splits: true,
      paidBy: { select: { id: true, name: true } },
    },
  });

  const mapped: ExpenseForBalance[] = expenses.map((e) => ({
    amountInCents: e.amountInCents,
    currency: e.currency,
    exchangeRateToInr: e.exchangeRateToInr.toString(),
    paidByUserId: e.paidByUserId,
    isSettlement: e.isSettlement,
    splits: e.splits.map((s) => ({
      userId: s.userId,
      owedAmountInCents: s.owedAmountInCents,
    })),
  }));

  const netBalances = calculateNetBalances(mapped);

  // Enrich with user names
  const users = await db.user.findMany({
    where: { id: { in: netBalances.map((b) => b.userId) } },
    select: { id: true, name: true },
  });

  const userMap = new Map<string, string>(users.map((u) => [u.id, u.name ?? "Unknown"]));

  return {
    balances: netBalances.map((b) => ({
      userId: b.userId,
      userName: userMap.get(b.userId) ?? "Unknown",
      balanceInPaise: b.balanceInCents,
    })),
    totalExpenses: expenses.length,
  };
}

// ---------------------------------------------------------------------------
// Get simplified debts
// ---------------------------------------------------------------------------

export interface SimplifiedDebtResult {
  transfers: Array<
    SimplifiedTransfer & {
      fromUserName: string;
      toUserName: string;
    }
  >;
}

export async function getSimplifiedDebts(
  groupId: string,
): Promise<SimplifiedDebtResult> {
  const { balances } = await getGroupBalances(groupId);

  const transfers = minimizeDebts(
    balances.map((b) => ({
      userId: b.userId,
      balanceInCents: b.balanceInPaise,
    })),
  );

  const userMap = new Map(
    balances.map((b) => [b.userId, b.userName]),
  );

  return {
    transfers: transfers.map((t) => ({
      ...t,
      fromUserName: userMap.get(t.fromUserId) ?? "Unknown",
      toUserName: userMap.get(t.toUserId) ?? "Unknown",
    })),
  };
}

// ---------------------------------------------------------------------------
// Get audit trail for a specific user
// ---------------------------------------------------------------------------

export interface AuditTrailResult {
  entries: AuditEntry[];
  finalBalanceInPaise: number;
  userName: string;
}

export async function getExpensesAudit(
  groupId: string,
  userId: string,
): Promise<AuditTrailResult> {
  const [expenses, user] = await Promise.all([
    db.expense.findMany({
      where: { groupId },
      include: { splits: true },
      orderBy: { date: "asc" },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
  ]);

  const mapped: ExpenseForAudit[] = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    date: e.date,
    currency: e.currency,
    exchangeRateToInr: e.exchangeRateToInr.toString(),
    amountInCents: e.amountInCents,
    paidByUserId: e.paidByUserId,
    isSettlement: e.isSettlement,
    splits: e.splits.map((s) => ({
      userId: s.userId,
      owedAmountInCents: s.owedAmountInCents,
    })),
  }));

  const entries = buildAuditTrail(mapped, userId);
  const finalBalance = entries.length > 0
    ? entries[entries.length - 1].runningBalanceInPaise
    : 0;

  return {
    entries,
    finalBalanceInPaise: finalBalance,
    userName: user?.name ?? "Unknown",
  };
}
