"use client";

import { useState, useCallback, useMemo } from "react";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { CheckIcon, ArrowRightIcon } from "@/components/icons";
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
      // Try to find the user name from rawData — fall back to userId
      const name = clean.rawData.split_with?.split(";").map((n) => n.trim())[clean.splits.indexOf(s)] ?? s.userId.slice(0, 8);
      return `${name}: ${fmtCents(s.owedAmountInCents)}`;
    })
    .join(", ");
}

/** Check if a row has any ERROR-level anomalies. */
function hasErrorAnomalies(row: ImportRowReport): boolean {
  return row.anomalies.some((a) => a.severity === "ERROR");
}

// ---------------------------------------------------------------------------
// Review Table
// ---------------------------------------------------------------------------

export function ReviewTable({ rows, onCommit, isCommitting }: ReviewTableProps) {
  const [decisions, setDecisions] = useState<Map<string, "APPROVED" | "REJECTED">>(() => {
    const initial = new Map<string, "APPROVED" | "REJECTED">();
    for (const row of rows) {
      if (!row.requiresReview) {
        initial.set(String(row.rowNumber), "APPROVED");
      }
    }
    return initial;
  });

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "clean" | "review">("all");

  // Memoized counts
  const errorFreeCount = useMemo(
    () => rows.filter((r) => !hasErrorAnomalies(r)).length,
    [rows],
  );

  const toggleRow = useCallback((rowNumber: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  }, []);

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

  const handleCommit = useCallback(() => {
    const rowDecisions: RowDecision[] = Array.from(decisions.entries()).map(
      ([rowNumberStr, decision]) => ({
        rowNumber: Number(rowNumberStr),
        decision,
      }),
    );
    onCommit(rowDecisions);
  }, [decisions, onCommit]);

  // Filter rows
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
              // Approve only rows with no ERROR anomalies
              for (const row of rows) {
                if (!hasErrorAnomalies(row)) {
                  next.set(String(row.rowNumber), "APPROVED");
                }
              }
              setDecisions(next);
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
            render: (row: ImportRowReport) => (
              <span className="max-w-[160px] truncate font-medium text-ink">
                {row.cleanRecord?.description ?? row.rawData.description ?? "—"}
              </span>
            ),
          },
          {
            key: "payer",
            header: "Payer",
            render: (row: ImportRowReport) => (
              <span className="text-sm text-muted">
                {row.rawData.paid_by || "—"}
              </span>
            ),
          },
          {
            key: "amount",
            header: "Amount",
            render: (row: ImportRowReport) => (
              <span className="font-mono text-sm font-medium text-ink">
                {row.cleanRecord?.amountInCents
                  ? fmtCents(row.cleanRecord.amountInCents)
                  : row.rawData.amount || "—"}
              </span>
            ),
          },
          {
            key: "splits",
            header: "Splits",
            render: (row: ImportRowReport) => {
              if (row.cleanRecord?.splits && row.cleanRecord.splits.length > 0) {
                return (
                  <span className="max-w-[220px] truncate text-xs text-muted" title={splitSummary(row.cleanRecord)}>
                    {splitSummary(row.cleanRecord)}
                  </span>
                );
              }
              if (row.rawData.split_details) {
                return (
                  <span className="max-w-[220px] truncate text-xs text-muted" title={row.rawData.split_details}>
                    {row.rawData.split_details}
                  </span>
                );
              }
              if (row.rawData.split_with) {
                return (
                  <span className="text-xs text-muted">
                    Equal ({row.rawData.split_with.replace(/;/g, ", ")})
                  </span>
                );
              }
              return <span className="text-xs text-muted">—</span>;
            },
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
          },
          {
            key: "decision",
            header: "Decision",
            render: (row: ImportRowReport) => {
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
          },
          {
            key: "actions",
            header: "",
            render: (row: ImportRowReport) => {
              if (!row.requiresReview && !hasErrorAnomalies(row)) {
                return null;
              }

              return (
                <div className="flex items-center gap-1">
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
                </div>
              );
            },
            className: "w-40",
          },
          {
            key: "expand",
            header: "",
            render: (row: ImportRowReport) =>
              row.anomalies.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleRow(row.rowNumber)}
                  className="text-xs font-medium text-indigo-action hover:underline"
                >
                  {expandedRows.has(row.rowNumber) ? "Less" : "Details"}
                </button>
              ) : null,
            className: "w-20",
          },
        ]}
        data={filteredRows}
        getRowKey={(row) => String(row.rowNumber)}
        emptyMessage="No rows match the current filter."
      />

      {/* Expanded rows: anomalies + split breakdown */}
      {filteredRows
        .filter((r) => expandedRows.has(r.rowNumber))
        .map((row) => (
          <div
            key={`details-${row.rowNumber}`}
            className="mt-2 space-y-2"
          >
            {/* Split breakdown */}
            {row.cleanRecord?.splits && row.cleanRecord.splits.length > 0 && (
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
        ))}

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
