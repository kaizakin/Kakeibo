"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { CheckIcon, ArrowRightIcon } from "@/components/icons";
import {
  updateImportRow,
  type ImportRowEdit,
  type UpdateImportRowResult,
} from "@/src/app/actions/updateImportRow";
import type { ImportRowReport, ImportAnomaly, CleanExpenseRecord } from "@/src/lib/import/types";
import type { RowDecision } from "@/src/app/actions/commitImport";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewTableProps {
  rows: ImportRowReport[];
  onCommit: (decisions: RowDecision[]) => void;
  isCommitting: boolean;
}

/** Editing state for a single row. */
interface RowEditState {
  description: string;
  payer: string;
  amount: string;
  date: string;
  splitType: string;
  splitWith: string;
  splitDetails: string;
  isSaving: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format cents to display currency string. */
function fmtCents(cents: number): string {
  const abs = Math.abs(cents);
  return `₹${(abs / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Build a readable split summary from a clean record. */
function splitSummary(clean: CleanExpenseRecord): string {
  return clean.splits
    .map((s) => {
      const name = clean.rawData.split_with?.split(";").map((n) => n.trim())[clean.splits.indexOf(s)] ?? s.userId.slice(0, 8);
      return `${name}: ${fmtCents(s.owedAmountInCents)}`;
    })
    .join(", ");
}

/** Check if a row has any ERROR-level anomalies. */
function hasErrorAnomalies(row: ImportRowReport): boolean {
  return row.anomalies.some((a) => a.severity === "ERROR");
}

/** Convert raw date from any format to DD-MM-YYYY. */
function toDDMMYYYY(dateStr: string): string {
  if (!dateStr) return "";
  // Already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  // ISO YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (isoMatch) return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  return dateStr;
}

// ---------------------------------------------------------------------------
// Review Table
// ---------------------------------------------------------------------------

export function ReviewTable({ rows: initialRows, onCommit, isCommitting }: ReviewTableProps) {
  const [rows, setRows] = useState<ImportRowReport[]>(initialRows);

  // Sync local rows state when the parent provides new data (e.g. re-upload)
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  const [decisions, setDecisions] = useState<Map<string, "APPROVED" | "REJECTED">>(() => {
    const initial = new Map<string, "APPROVED" | "REJECTED">();
    for (const row of initialRows) {
      if (!row.requiresReview) {
        initial.set(String(row.rowNumber), "APPROVED");
      }
    }
    return initial;
  });

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "clean" | "review">("all");
  const [editingRows, setEditingRows] = useState<Map<number, RowEditState>>(new Map());

  // Memoized counts
  const errorFreeCount = useMemo(
    () => rows.filter((r) => !hasErrorAnomalies(r)).length,
    [rows],
  );

  // ── Expand / collapse ───────────────────────────────────────────────────
  const toggleRow = useCallback((rowNumber: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
    setTimeout(() => {
      const el = document.getElementById(`details-${rowNumber}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }, []);

  // ── Decisions ───────────────────────────────────────────────────────────
  const setDecision = useCallback(
    (rowNumber: number, decision: "APPROVED" | "REJECTED") => {
      setDecisions((prev) => {
        const next = new Map(prev);
        next.set(String(rowNumber), decision);
        return next;
      });
    },
    [],
  );

  // ── Start editing a row ─────────────────────────────────────────────────
  const startEditing = useCallback((row: ImportRowReport) => {
    setEditingRows((prev) => {
      const next = new Map(prev);
      next.set(row.rowNumber, {
        description: row.rawData.description ?? "",
        payer: row.rawData.paid_by ?? "",
        amount: row.rawData.amount ?? "",
        date: toDDMMYYYY(row.rawData.date ?? ""),
        splitType: row.rawData.split_type ?? "equal",
        splitWith: row.rawData.split_with ?? "",
        splitDetails: row.rawData.split_details ?? "",
        isSaving: false,
      });
      return next;
    });
    // Expand the row so the split editor is visible
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.add(row.rowNumber);
      return next;
    });
  }, []);

  // ── Cancel editing ──────────────────────────────────────────────────────
  const cancelEditing = useCallback((rowNumber: number) => {
    setEditingRows((prev) => {
      const next = new Map(prev);
      next.delete(rowNumber);
      return next;
    });
  }, []);

  // ── Update an edit field ────────────────────────────────────────────────
  const updateEditField = useCallback(
    (rowNumber: number, field: keyof RowEditState, value: string) => {
      setEditingRows((prev) => {
        const next = new Map(prev);
        const current = next.get(rowNumber);
        if (current) {
          next.set(rowNumber, { ...current, [field]: value });
        }
        return next;
      });
    },
    [],
  );

  // ── Save edited row ─────────────────────────────────────────────────────
  const saveEditing = useCallback(async (rowNumber: number) => {
    const editState = editingRows.get(rowNumber);
    if (!editState) return;

    const row = rows.find((r) => r.rowNumber === rowNumber);
    if (!row?.id) {
      toast.error("Cannot edit this row: missing database ID");
      return;
    }

    // Mark as saving
    setEditingRows((prev) => {
      const next = new Map(prev);
      next.set(rowNumber, { ...editState, isSaving: true });
      return next;
    });

    const edits: ImportRowEdit = {
      description: editState.description,
      payer: editState.payer,
      amount: editState.amount,
      paidByUserId: row.cleanRecord?.paidByUserId ?? null,
      date: editState.date,
      splitType: editState.splitType,
      splitWith: editState.splitWith,
      splitDetails: editState.splitDetails,
    };

    const result: UpdateImportRowResult = await updateImportRow(row.id, edits);

    if (result.success && result.updatedRow) {
      // Update the row in local state
      setRows((prev) =>
        prev.map((r) =>
          r.rowNumber === rowNumber
            ? { ...r, ...result.updatedRow! }
            : r,
        ),
      );

      // Reset decision for this row (needs fresh review)
      setDecisions((prev) => {
        const next = new Map(prev);
        next.delete(String(rowNumber));
        return next;
      });

      // Exit edit mode
      setEditingRows((prev) => {
        const next = new Map(prev);
        next.delete(rowNumber);
        return next;
      });

      const anomalyCount = result.updatedRow.anomalies.length;
      toast.success("Row updated", {
        description: anomalyCount > 0
          ? `Re-validated — ${anomalyCount} anomaly(ies) detected`
          : "Re-validated — all clear",
      });
    } else {
      toast.error("Failed to update row", {
        description: result.error ?? "Unknown error",
      });
      setEditingRows((prev) => {
        const next = new Map(prev);
        next.set(rowNumber, { ...editState, isSaving: false });
        return next;
      });
    }
  }, [editingRows, rows]);

  // ── Commit ──────────────────────────────────────────────────────────────
  const handleCommit = useCallback(() => {
    const rowDecisions: RowDecision[] = Array.from(decisions.entries()).map(
      ([rowNumberStr, decision]) => ({
        rowNumber: Number(rowNumberStr),
        decision,
      }),
    );
    onCommit(rowDecisions);
  }, [decisions, onCommit]);

  // ── Filter rows ─────────────────────────────────────────────────────────
  const filteredRows = rows.filter((row) => {
    if (filter === "all") return true;
    if (filter === "clean") return !row.requiresReview;
    if (filter === "review") return row.requiresReview;
    return true;
  });

  // Stats
  const totalDecided = decisions.size;
  const approvedCount = Array.from(decisions.values()).filter(
    (d) => d === "APPROVED",
  ).length;
  const needsDecisionCount = rows.filter((r) => r.requiresReview).length;

  // ── Render helpers ──────────────────────────────────────────────────────

  /** Get the edit state for a row, if currently editing. */
  const getEdit = (rowNumber: number): RowEditState | undefined =>
    editingRows.get(rowNumber);

  /** Render editable description cell. */
  const renderDescription = (row: ImportRowReport) => {
    const edit = getEdit(row.rowNumber);
    if (edit) {
      return (
        <input
          type="text"
          value={edit.description}
          onChange={(e) => updateEditField(row.rowNumber, "description", e.target.value)}
          className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return (
      <div
        className="truncate font-medium text-ink"
        title={row.cleanRecord?.description ?? row.rawData.description ?? "—"}
      >
        {row.cleanRecord?.description ?? row.rawData.description ?? "—"}
      </div>
    );
  };

  /** Render editable payer cell. */
  const renderPayer = (row: ImportRowReport) => {
    const edit = getEdit(row.rowNumber);
    if (edit) {
      return (
        <input
          type="text"
          value={edit.payer}
          onChange={(e) => updateEditField(row.rowNumber, "payer", e.target.value)}
          className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return (
      <div className="break-words text-sm text-muted">
        {row.rawData.paid_by || "—"}
      </div>
    );
  };

  /** Render editable amount cell. */
  const renderAmount = (row: ImportRowReport) => {
    const edit = getEdit(row.rowNumber);
    if (edit) {
      return (
        <input
          type="text"
          value={edit.amount}
          onChange={(e) => updateEditField(row.rowNumber, "amount", e.target.value)}
          placeholder="e.g. 1200"
          className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-right font-mono text-sm text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return (
      <div className="break-words font-mono text-sm font-medium text-ink">
        {row.cleanRecord?.amountInCents
          ? fmtCents(row.cleanRecord.amountInCents)
          : row.rawData.amount || "—"}
      </div>
    );
  };

  /** Render splits cell. */
  const renderSplits = (row: ImportRowReport) => {
    const edit = getEdit(row.rowNumber);
    if (edit) {
      return (
        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
          <select
            value={edit.splitType}
            onChange={(e) => updateEditField(row.rowNumber, "splitType", e.target.value)}
            className="mb-1 w-full rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
          >
            <option value="equal">Equal</option>
            <option value="exact">Exact</option>
            <option value="percentage">Percentage</option>
            <option value="share">Share</option>
          </select>
          <input
            type="text"
            value={edit.splitWith}
            onChange={(e) => updateEditField(row.rowNumber, "splitWith", e.target.value)}
            placeholder="Names (; separated)"
            className="w-full rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
          />
          <input
            type="text"
            value={edit.splitDetails}
            onChange={(e) => updateEditField(row.rowNumber, "splitDetails", e.target.value)}
            placeholder="Name value; Name value (for exact/%)"
            className="w-full rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
          />
        </div>
      );
    }

    if (row.cleanRecord?.splits && row.cleanRecord.splits.length > 0) {
      return (
        <div className="break-words text-xs text-muted leading-relaxed" title={splitSummary(row.cleanRecord)}>
          {splitSummary(row.cleanRecord)}
        </div>
      );
    }
    if (row.rawData.split_details) {
      return (
        <div className="break-words text-xs text-muted leading-relaxed" title={row.rawData.split_details}>
          {row.rawData.split_details}
        </div>
      );
    }
    if (row.rawData.split_with) {
      return (
        <div className="break-words text-xs text-muted leading-relaxed" title={`Equal (${row.rawData.split_with.replace(/;/g, ", ")})`}>
          Equal ({row.rawData.split_with.replace(/;/g, ", ")})
        </div>
      );
    }
    return <div className="text-xs text-muted">—</div>;
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Controls bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Filter tabs */}
        <div className="flex gap-1 rounded-xl border border-line bg-canvas p-1">
          {(["all", "clean", "review"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {f === "all" ? "All" : f === "clean" ? "Clean" : "Needs review"}
              <span className="ml-1.5 text-muted">
                (
                {f === "all"
                  ? rows.length
                  : f === "clean"
                    ? rows.filter((r) => !r.requiresReview).length
                    : rows.filter((r) => r.requiresReview).length}
                )
              </span>
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const next = new Map(decisions);
              for (const row of rows) {
                if (!hasErrorAnomalies(row)) {
                  next.set(String(row.rowNumber), "APPROVED");
                }
              }
              setDecisions(next);
              toast.success(`Approved ${errorFreeCount} error-free records`);
            }}
            className="rounded-lg border border-sage-200 bg-sage-50 px-3 py-1.5 text-xs font-semibold text-sage-700 transition-colors hover:bg-sage-100"
          >
            Approve error-free ({errorFreeCount})
          </button>
          <button
            type="button"
            onClick={() => {
              const next = new Map(decisions);
              for (const row of rows) {
                next.set(String(row.rowNumber), "APPROVED");
              }
              setDecisions(next);
              toast.success("Approved all records");
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-sage-50"
          >
            Approve all
          </button>
          <button
            type="button"
            onClick={() => {
              const next = new Map(decisions);
              for (const row of rows) {
                if (row.requiresReview) {
                  next.set(String(row.rowNumber), "REJECTED");
                } else {
                  next.set(String(row.rowNumber), "APPROVED");
                }
              }
              setDecisions(next);
              toast.success("Rejected flagged records");
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-red-50 hover:text-red-700"
          >
            Reject flagged
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={[
          {
            key: "row",
            header: "Row",
            render: (row: ImportRowReport) => (
              <span className="font-mono text-xs text-muted">
                #{row.rowNumber}
              </span>
            ),
            className: "w-16",
          },
          {
            key: "description",
            header: "Description",
            render: renderDescription,
            className: "w-[200px]",
          },
          {
            key: "payer",
            header: "Payer",
            render: renderPayer,
            className: "w-[100px]",
          },
          {
            key: "amount",
            header: "Amount",
            render: renderAmount,
            className: "w-[110px]",
          },
          {
            key: "splits",
            header: "Splits",
            render: renderSplits,
            className: "w-[280px]",
          },
          {
            key: "status",
            header: "Status",
            render: (row: ImportRowReport) => {
              const hasErrors = row.anomalies.some((a) => a.severity === "ERROR");
              const hasWarnings = row.anomalies.some((a) => a.severity === "WARNING");
              const status = hasErrors
                ? "ERROR"
                : hasWarnings
                  ? "NEEDS_REVIEW"
                  : "CLEAN";
              return <StatusBadge status={status} />;
            },
            className: "w-[120px]",
          },
          {
            key: "decision",
            header: "Decision",
            render: (row: ImportRowReport) => {
              const edit = getEdit(row.rowNumber);
              if (edit) return null; // Hide decision while editing

              const decision = decisions.get(String(row.rowNumber));

              if (!row.requiresReview && !hasErrorAnomalies(row)) {
                return <StatusBadge status="CLEAN" />;
              }

              if (decision === "APPROVED") {
                return <StatusBadge status="APPROVED" />;
              }
              if (decision === "REJECTED") {
                return <StatusBadge status="REJECTED" />;
              }

              return (
                <span className="text-xs text-muted">Undecided</span>
              );
            },
            className: "w-[100px]",
          },
          {
            key: "actions",
            header: "",
            render: (row: ImportRowReport) => {
              const edit = getEdit(row.rowNumber);

              // Show Save/Cancel when editing
              if (edit) {
                return (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={edit.isSaving}
                      onClick={() => saveEditing(row.rowNumber)}
                      className="rounded-lg bg-indigo-action px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-indigo-hover disabled:cursor-wait disabled:opacity-60"
                    >
                      {edit.isSaving ? (
                        <span className="inline-block size-3 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      ) : (
                        "Save"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelEditing(row.rowNumber)}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-gray-100 hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                );
              }

              // Show Approve/Reject/Edit when not editing
              const isClean = !row.requiresReview && !hasErrorAnomalies(row);

              return (
                <div className="flex items-center gap-1">
                  {!isClean && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDecision(row.rowNumber, "APPROVED")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                          decisions.get(String(row.rowNumber)) === "APPROVED"
                            ? "bg-sage-100 text-sage-700"
                            : "text-muted hover:bg-sage-50 hover:text-sage-700"
                        }`}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecision(row.rowNumber, "REJECTED")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                          decisions.get(String(row.rowNumber)) === "REJECTED"
                            ? "bg-red-50 text-red-700"
                            : "text-muted hover:bg-red-50 hover:text-red-700"
                        }`}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => startEditing(row)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      edit ? "bg-indigo-soft text-indigo-action" : "text-muted hover:bg-indigo-soft hover:text-indigo-action"
                    }`}
                  >
                    Edit
                  </button>
                </div>
              );
            },
            className: "w-[180px]",
          },
          {
            key: "expand",
            header: "",
            render: (row: ImportRowReport) => {
              const edit = getEdit(row.rowNumber);
              // Always show expand when editing (shows split editor)
              if (edit || row.anomalies.length > 0) {
                return (
                  <button
                    type="button"
                    onClick={() => toggleRow(row.rowNumber)}
                    className="text-xs font-medium text-indigo-action hover:underline"
                  >
                    {expandedRows.has(row.rowNumber) ? "Less" : "Details"}
                  </button>
                );
              }
              return null;
            },
            className: "w-20",
          },
        ]}
        data={filteredRows}
        getRowKey={(row) => String(row.rowNumber)}
        emptyMessage="No rows match the current filter."
      />

      {/* Expanded rows: anomalies + split breakdown + inline split editor */}
      {filteredRows
        .filter((r) => expandedRows.has(r.rowNumber))
        .map((row) => {
          const edit = getEdit(row.rowNumber);

          return (
            <div
              key={`details-${row.rowNumber}`}
              id={`details-${row.rowNumber}`}
              className="mt-2 space-y-2"
            >
              {/* Inline split editor when editing */}
              {edit && (
                <div className="rounded-xl border border-indigo-action/20 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-indigo-action">
                    Split editor — Row #{row.rowNumber}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Split type
                      </label>
                      <select
                        value={edit.splitType}
                        onChange={(e) => updateEditField(row.rowNumber, "splitType", e.target.value)}
                        className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
                      >
                        <option value="equal">Equal — divide evenly</option>
                        <option value="exact">Exact — fixed amounts</option>
                        <option value="percentage">Percentage — % of total</option>
                        <option value="share">Share — ratio-based</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Date
                      </label>
                      <input
                        type="text"
                        value={edit.date}
                        onChange={(e) => updateEditField(row.rowNumber, "date", e.target.value)}
                        placeholder="DD-MM-YYYY"
                        className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Participants (; separated)
                      </label>
                      <input
                        type="text"
                        value={edit.splitWith}
                        onChange={(e) => updateEditField(row.rowNumber, "splitWith", e.target.value)}
                        placeholder="e.g. Aisha; Rohan; Priya"
                        className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Amounts (name value; name value)
                      </label>
                      <input
                        type="text"
                        value={edit.splitDetails}
                        onChange={(e) => updateEditField(row.rowNumber, "splitDetails", e.target.value)}
                        placeholder="e.g. Aisha 700; Rohan 400"
                        className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
                      />
                      <p className="mt-1 text-[10px] text-muted">
                        For exact: &ldquo;Name amount&rdquo;. For %: &ldquo;Name 30%&rdquo;. For share: &ldquo;Name 2&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Split breakdown */}
              {!edit && row.cleanRecord?.splits && row.cleanRecord.splits.length > 0 && (
                <div className="rounded-xl border border-line bg-white p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Split breakdown — Row #{row.rowNumber}
                  </p>
                  <div className="space-y-1.5">
                    {row.cleanRecord.splits.map((s, i) => {
                      const names = row.rawData.split_with?.split(";").map((n) => n.trim()) ?? [];
                      const name = names[i] ?? s.userId.slice(0, 8);
                      const payerName = row.rawData.paid_by?.trim();
                      const isPayer = name.toLowerCase() === payerName?.toLowerCase();
                      return (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                          <span className="font-medium text-ink">
                            {name}
                            {isPayer && (
                              <span className="ml-1.5 rounded bg-indigo-soft px-1.5 py-0.5 text-[10px] font-semibold text-indigo-action">
                                Paid
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-sm font-bold text-ink">
                            {fmtCents(s.owedAmountInCents)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Anomalies */}
              {row.anomalies.length > 0 && (
                <div className="rounded-xl border border-amber-line bg-amber-soft p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-ink">
                    Anomalies — Row #{row.rowNumber}
                  </p>
                  <div className="space-y-2">
                    {row.anomalies.map((anomaly, i) => (
                      <AnomalyDetail key={i} anomaly={anomaly} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {/* Commit bar */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted">
            <strong className="text-ink">{totalDecided}</strong> rows decided
          </span>
          <span className="text-sage-700">
            <CheckIcon className="mr-1 inline size-3.5" />
            <strong>{approvedCount}</strong> to commit
          </span>
          {needsDecisionCount > 0 && (
            <span className="text-amber-ink">
              <strong>{needsDecisionCount}</strong> need decision
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCommit}
          disabled={
            isCommitting || totalDecided < rows.length || approvedCount === 0
          }
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-action px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCommitting ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              Committing...
            </>
          ) : (
            <>
              Commit {approvedCount} record{approvedCount !== 1 ? "s" : ""}
              <ArrowRightIcon className="size-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Anomaly Detail
// ---------------------------------------------------------------------------

const severityColors: Record<string, string> = {
  ERROR: "border-red-200 bg-red-50",
  WARNING: "border-amber-line bg-amber-soft",
  INFO: "border-sage-200 bg-sage-50",
};

function AnomalyDetail({ anomaly }: { anomaly: ImportAnomaly }) {
  const bg = severityColors[anomaly.severity] ?? "border-line bg-white";

  return (
    <div className={`rounded-lg border p-3 text-sm ${bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            {anomaly.code.replace(/_/g, " ")}
          </span>
          <StatusBadge
            status={anomaly.severity as "ERROR" | "WARNING" | "INFO"}
          />
        </div>
      </div>
      <p className="mt-1 text-muted">{anomaly.message}</p>
      {anomaly.details && Object.keys(anomaly.details).length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-medium text-indigo-action hover:underline">
            View details
          </summary>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-white/60 p-2 font-mono text-xs text-muted">
            {JSON.stringify(anomaly.details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
