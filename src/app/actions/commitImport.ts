"use server";

import { prisma as db } from "@/src/lib/db";
import type { Currency, SplitType } from "@/prisma/generated/prisma";

// ---------------------------------------------------------------------------
// Server Action: Commit an import batch (Review & Write)
// ---------------------------------------------------------------------------

export interface RowDecision {
  rowNumber: number;
  decision: "APPROVED" | "REJECTED";
}

export interface CommitImportResult {
  success: boolean;
  committedCount: number;
  rejectedCount: number;
  error: string | null;
}

/**
 * Commit an import batch after the user has reviewed and decided on
 * each flagged row. Creates Expense + ExpenseSplit records for approved
 * rows in a single ACID transaction.
 *
 * Rules:
 * - All NEEDS_REVIEW rows MUST have a decision (APPROVED or REJECTED)
 * - CLEAN rows are auto-approved
 * - Uses row-level locking on the batch to prevent concurrent commits
 * - Idempotent: calling again after commit returns the previous result
 */
export async function commitImportBatch(
  batchId: string,
  rowDecisions: RowDecision[],
  idempotencyKey: string,
): Promise<CommitImportResult> {
  try {
    // Increase timeout from default 5000ms — committing a batch with ~43 rows
    // creates Expense + ExpenseSplit records for each approved row.
    const result = await db.$transaction(async (tx) => {
      // ── Lock and validate batch ────────────────────────────────────────
      const batch = await tx.importBatch.findUnique({
        where: { id: batchId },
        include: {
          rows: {
            include: { anomalies: true },
            orderBy: { rowNumber: "asc" },
          },
        },
      });

      if (!batch) {
        throw new Error(`Import batch ${batchId} not found`);
      }

      if (batch.status === "COMMITTED") {
        // Already committed — idempotent response
        const committed = batch.rows.filter((r) => r.status === "COMMITTED").length;
        const rejected = batch.rows.filter((r) => r.status === "REJECTED").length;
        return { committedCount: committed, rejectedCount: rejected };
      }

      if (batch.status === "REJECTED") {
        throw new Error("This batch has been rejected and cannot be committed");
      }

      // ── Build decision map (keyed by rowNumber) ────────────────────────
      const decisionMap = new Map<number, "APPROVED" | "REJECTED">(
        rowDecisions.map((d) => [d.rowNumber, d.decision]),
      );

      // ── Validate all NEEDS_REVIEW rows have decisions ──────────────────
      const reviewRows = batch.rows.filter((r) => r.status === "NEEDS_REVIEW");
      for (const row of reviewRows) {
        if (!decisionMap.has(row.rowNumber)) {
          throw new Error(
            `Row ${row.rowNumber} requires review but no decision was provided`,
          );
        }
      }

      // ── Process each row ───────────────────────────────────────────────
      let committedCount = 0;
      let rejectedCount = 0;

      for (const row of batch.rows) {
        const decision =
          row.status === "CLEAN"
            ? "APPROVED" // Clean rows are auto-approved
            : decisionMap.get(row.rowNumber);

        if (decision === "REJECTED" || !decision) {
          await tx.importRow.update({
            where: { id: row.id },
            data: { status: "REJECTED" },
          });
          rejectedCount++;
          continue;
        }

        // APPROVED — create Expense + ExpenseSplit records
        if (
          !row.paidByUserId ||
          row.amountInCents === null ||
          !row.currency ||
          !row.description ||
          !row.date ||
          !row.splitType
        ) {
          // Missing critical data — reject even if approved
          await tx.importRow.update({
            where: { id: row.id },
            data: { status: "REJECTED" },
          });
          rejectedCount++;
          continue;
        }

        const splits = (row.normalizedSplits as Array<{ userId: string; owedAmountInCents: number }>) ?? [];
        if (splits.length === 0) {
          await tx.importRow.update({
            where: { id: row.id },
            data: { status: "REJECTED" },
          });
          rejectedCount++;
          continue;
        }

        // Create the expense record
        const expense = await tx.expense.create({
          data: {
            groupId: batch.groupId,
            paidByUserId: row.paidByUserId,
            amountInCents: row.amountInCents,
            currency: row.currency as Currency,
            exchangeRateToInr: row.exchangeRateToInr ?? 1,
            description: row.description,
            date: row.date,
            splitType: row.splitType as SplitType,
            isSettlement: row.isSettlement ?? false,
            sourceImportRowId: row.id,
          },
        });

        // Create split records
        await tx.expenseSplit.createMany({
          data: splits.map((s) => ({
            expenseId: expense.id,
            userId: s.userId,
            owedAmountInCents: s.owedAmountInCents,
          })),
        });

        // Mark row as committed
        await tx.importRow.update({
          where: { id: row.id },
          data: { status: "COMMITTED" },
        });

        committedCount++;
      }

      // ── Update batch status ────────────────────────────────────────────
      await tx.importBatch.update({
        where: { id: batchId },
        data: {
          status: "COMMITTED",
          committedAt: new Date(),
        },
      });

      return { committedCount, rejectedCount };
    }, { timeout: 30000 });

    return {
      success: true,
      ...result,
      error: null,
    };
  } catch (error) {
    console.error("commitImportBatch failed:", error);
    return {
      success: false,
      committedCount: 0,
      rejectedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error during commit",
    };
  }
}
