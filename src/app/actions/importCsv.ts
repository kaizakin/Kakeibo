"use server";

import { prisma as db } from "@/src/lib/db";
import { runImportPipeline } from "@/src/lib/import/pipeline";
import type { ImportPolicy, ImportReport } from "@/src/lib/import/types";
import type { AnomalyCode, AnomalySeverity, Currency, SplitType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Server Action: Stage an import (Parse & Analyze)
// ---------------------------------------------------------------------------

export interface StageImportResult {
  success: boolean;
  batchId: string | null;
  report: ImportReport | null;
  error: string | null;
}

/**
 * Parse a CSV string, run the anomaly detection pipeline, and stage
 * the results into the ImportBatch / ImportRow / ImportAnomaly tables.
 *
 * This does NOT create any Expense records — that happens in commitImport.
 *
 * Uses the idempotencyKey to prevent double-processing of the same upload.
 */
export async function stageImport(
  groupId: string,
  csvContent: string,
  idempotencyKey: string,
): Promise<StageImportResult> {
  try {
    // ── Ensure the group exists ─────────────────────────────────────────────
    // The group must exist before creating an ImportBatch referencing it.
    // Auto-create if it was deleted (e.g., by db:nuke).
    const groupName = groupId
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    await db.group.upsert({
      where: { id: groupId },
      update: {},
      create: { id: groupId, name: groupName },
    });

    // ── Idempotency check ──────────────────────────────────────────────────
    const existing = await db.importBatch.findUnique({
      where: { groupId_idempotencyKey: { groupId, idempotencyKey } },
    });

    if (existing) {
      return {
        success: false,
        batchId: existing.id,
        report: null,
        error: "This CSV has already been staged. Check the existing import batch.",
      };
    }

    // ── Build import policy from database state ────────────────────────────
    const [users, memberships] = await Promise.all([
      db.user.findMany({
        where: {
          memberships: { some: { groupId } },
        },
        select: { id: true, name: true, email: true },
      }),
      db.groupMembership.findMany({
        where: { groupId },
        select: { userId: true, joinedAt: true, leftAt: true },
      }),
    ]);

    const policy: ImportPolicy = {
      now: new Date(),
      users: users.map((u) => ({
        id: u.id,
        name: u.name ?? u.email,
        email: u.email,
      })),
      memberships: memberships.map((m) => ({
        userId: m.userId,
        joinedAt: m.joinedAt.toISOString(),
        leftAt: m.leftAt?.toISOString() ?? null,
      })),
      defaultCurrency: "INR",
      usdToInrRate: "83",
      groupId,
    };

    // ── Run the pure import pipeline ───────────────────────────────────────
    const report = runImportPipeline(csvContent, policy);

    // ── Persist to staging tables in a single transaction ──────────────────
    // Increase timeout from default 5000ms — the CSV can have ~43 rows, each
    // creating an ImportRow + anomaly records, which takes >5s with Neon PG.
    const batch = await db.$transaction(async (tx) => {
      const importBatch = await tx.importBatch.create({
        data: {
          groupId,
          idempotencyKey,
          status: "REVIEW",
        },
      });

      for (const row of report.rows) {
        const clean = row.cleanRecord;
        const hasErrors = row.anomalies.some((a) => a.severity === "ERROR");
        const hasWarnings = row.anomalies.some((a) => a.severity === "WARNING");
        const status = hasErrors || hasWarnings ? "NEEDS_REVIEW" : "CLEAN";

        const importRow = await tx.importRow.create({
          data: {
            batchId: importBatch.id,
            rowNumber: row.rowNumber,
            rawData: row.rawData,
            status,
            paidByUserId: clean?.paidByUserId ?? null,
            amountInCents: clean?.amountInCents ?? null,
            currency: clean?.currency as Currency | null ?? null,
            exchangeRateToInr: clean?.exchangeRateToInr ?? null,
            description: clean?.description ?? null,
            date: clean?.date ? new Date(clean.date) : null,
            splitType: clean?.splitType as SplitType | null ?? null,
            isSettlement: clean?.isSettlement ?? null,
            normalizedSplits: clean?.splits ?? null,
          },
        });

        // Create anomaly records
        if (row.anomalies.length > 0) {
          await tx.importAnomaly.createMany({
            data: row.anomalies.map((a) => ({
              importRowId: importRow.id,
              code: a.code as AnomalyCode,
              severity: a.severity as AnomalySeverity,
              message: a.message,
              details: a.details ?? null,
            })),
          });
        }
      }

      return importBatch;
    }, { timeout: 30000 });

    return {
      success: true,
      batchId: batch.id,
      report,
      error: null,
    };
  } catch (error) {
    console.error("stageImport failed:", error);
    return {
      success: false,
      batchId: null,
      report: null,
      error: error instanceof Error ? error.message : "Unknown error during import staging",
    };
  }
}
