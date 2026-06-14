"use server";

import { prisma as db } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { getActiveGroup } from "@/src/lib/active-group";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateExpenseInput = {
  paidByUserId: string;
  amountInCents: number;
  currency: "USD" | "INR";
  description: string;
  date: string;
  splitType: "EQUAL" | "EXACT";
  splits: Array<{ userId: string; owedAmountInCents: number }>;
  idempotencyKey: string;
};

export type CreateExpenseResult = {
  success: boolean;
  error: string | null;
};

// ---------------------------------------------------------------------------
// Server Action: Create a manual expense
// ---------------------------------------------------------------------------

/**
 * Creates an expense with split records in a single ACID transaction.
 *
 * Validates:
 *  - Authenticated user
 *  - Active group exists
 *  - User is a member of the group
 *  - Payer is a member of the group
 *  - All split participants are members of the group
 *  - Split amounts sum to the total
 *  - Idempotency (prevents double-submit)
 */
export async function createExpense(
  input: CreateExpenseInput,
): Promise<CreateExpenseResult> {
  try {
    // ── Auth & context ──────────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const groupId = await getActiveGroup();
    if (!groupId) {
      return { success: false, error: "No active group selected" };
    }

    // ── Validate the user is a member ────────────────────────────────────
    const myMembership = await db.groupMembership.findFirst({
      where: { groupId, userId: session.user.id, leftAt: null },
    });
    if (!myMembership) {
      return { success: false, error: "You are not a member of this group" };
    }

    // ── Validate input basics ───────────────────────────────────────────
    if (input.amountInCents <= 0) {
      return { success: false, error: "Amount must be greater than zero" };
    }
    if (!input.description.trim()) {
      return { success: false, error: "Description is required" };
    }
    if (input.splits.length === 0) {
      return {
        success: false,
        error: "At least one person must be included in the split",
      };
    }

    // ── Validate all participants are group members ──────────────────────
    const allUserIds = [
      input.paidByUserId,
      ...input.splits.map((s) => s.userId),
    ];
    const uniqueUserIds = [...new Set(allUserIds)];

    const memberships = await db.groupMembership.findMany({
      where: {
        groupId,
        userId: { in: uniqueUserIds },
        leftAt: null,
      },
      select: { userId: true },
    });

    const validUserIds = new Set(memberships.map((m) => m.userId));
    const invalidUsers = uniqueUserIds.filter((id) => !validUserIds.has(id));
    if (invalidUsers.length > 0) {
      return {
        success: false,
        error: "Some participants are not active members of this group",
      };
    }

    // ── Validate split amounts sum to total ─────────────────────────────
    const totalFromSplits = input.splits.reduce(
      (sum, s) => sum + s.owedAmountInCents,
      0,
    );
    if (totalFromSplits !== input.amountInCents) {
      return {
        success: false,
        error: `Split amounts (${totalFromSplits}) must equal the total (${input.amountInCents})`,
      };
    }

    // ── Idempotency check ───────────────────────────────────────────────
    const existingKey = await db.mutationKey.findUnique({
      where: {
        groupId_idempotencyKey_operation: {
          groupId,
          idempotencyKey: input.idempotencyKey,
          operation: "createExpense",
        },
      },
    });
    if (existingKey) {
      return {
        success: false,
        error: "This expense has already been submitted",
      };
    }

    // ── Create expense + splits in a transaction ────────────────────────
    await db.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId,
          paidByUserId: input.paidByUserId,
          amountInCents: input.amountInCents,
          currency: input.currency,
          exchangeRateToInr: input.currency === "USD" ? 83 : 1,
          description: input.description.trim(),
          date: new Date(input.date),
          splitType: input.splitType,
          isSettlement: false,
        },
      });

      await tx.expenseSplit.createMany({
        data: input.splits.map((s) => ({
          expenseId: expense.id,
          userId: s.userId,
          owedAmountInCents: s.owedAmountInCents,
        })),
      });

      await tx.mutationKey.create({
        data: {
          groupId,
          idempotencyKey: input.idempotencyKey,
          operation: "createExpense",
        },
      });
    });

    revalidatePath("/dashboard", "layout");
    return { success: true, error: null };
  } catch (error) {
    console.error("createExpense failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error creating expense",
    };
  }
}
