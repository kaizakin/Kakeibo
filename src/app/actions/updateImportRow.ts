"use server";

import { prisma as db } from "@/src/lib/db";

export interface ImportRowEdit {
  description: string;
  payer: string;         // Payer name from the edit form (e.g. "Aisha")
  amount: string;        // Raw amount string (e.g. "1200")
  paidByUserId: string | null;
  date: string;          // DD-MM-YYYY format
  splitType: string;     // equal | exact | percentage | share
  splitWith: string;     // Semicolon-separated names
  splitDetails: string;  // Semicolon-separated name-value pairs
}

/**
 * Update an ImportRow's data after the user edits it in the review phase.
 *
 * Re-parses the edited fields (amount, payer, date) so the commit step
 * reads the correct values from the database.
 */
export async function updateImportRow(
  importRowId: string,
  edits: ImportRowEdit,
) {
  await db.$transaction(async (tx) => {
    // ── Resolve payer name to a user ID ────────────────────────────────────
    // The payer name comes from rawData.paid_by in the edit form.
    // Look up the user by name (case-insensitive) from the import row's batch group.
    const importRow = await tx.importRow.findUnique({
      where: { id: importRowId },
      include: { batch: { select: { groupId: true } } },
    });

    if (!importRow) throw new Error("ImportRow not found");

    // Parse the payer name from the raw data in the edits
    // We use the split_with first name as a heuristic, or look up the payer directly
    let paidByUserId: string | null = null;

    // Try to find the payer name in the group members
    const groupMembers = await tx.groupMembership.findMany({
      where: { groupId: importRow.batch.groupId },
      include: { user: { select: { id: true, name: true } } },
    });

    // Resolve the payer name to a user ID
    const payerName = edits.payer.trim();
    if (payerName) {
      const member = groupMembers.find(
        (m) => m.user.name?.toLowerCase() === payerName.toLowerCase(),
      );
      if (member) {
        paidByUserId = member.user.id;
      }
    }

    // ── Parse the amount ──────────────────────────────────────────────────
    let amountInCents: number | null = null;
    const cleanedAmount = edits.amount.replace(/[₹$,\s]/g, "").trim();
    const parsedAmount = Number(cleanedAmount);
    if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
      amountInCents = Math.round(parsedAmount * 100);
    }

    // ── Parse the date ────────────────────────────────────────────────────
    let parsedDate: Date | null = null;
    if (edits.date) {
      const parts = edits.date.split("-");
      if (parts.length === 3) {
        const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(d.getTime())) parsedDate = d;
      }
    }

    // Build updated rawData
    const rawData = {
      date: edits.date,
      description: edits.description,
      paid_by: payerName || "",
      amount: edits.amount,
      currency: "INR",
      split_type: edits.splitType,
      split_with: edits.splitWith,
      split_details: edits.splitDetails,
      notes: "",
    };

    // ── Delete old anomalies ──────────────────────────────────────────────
    await tx.importAnomaly.deleteMany({
      where: { importRowId },
    });

    // ── Update the ImportRow with re-parsed fields ────────────────────────
    await tx.importRow.update({
      where: { id: importRowId },
      data: {
        rawData,
        status: "NEEDS_REVIEW",
        paidByUserId,
        amountInCents,
        description: edits.description,
        date: parsedDate,
        normalizedSplits: null, // Will be rebuilt on commit
      },
    });
  });

  return { success: true };
}
