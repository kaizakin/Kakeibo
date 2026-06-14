"use client";

import { useState, useTransition, useCallback } from "react";
import { stageImport, type StageImportResult } from "@/src/app/actions/importCsv";
import { commitImportBatch, type RowDecision } from "@/src/app/actions/commitImport";
import { ReviewTable } from "./review-table";
import { StatusBadge } from "@/components/status-badge";
import { AuditIcon, ArrowRightIcon, CheckIcon } from "@/components/icons";
import type { ImportReport } from "@/src/lib/import/types";
import { toast } from "sonner";

const GROUP_ID = "pine-street-house";

type Phase = "upload" | "review" | "committed";

export default function ImportPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [commitResult, setCommitResult] = useState<{ committed: number; rejected: number } | null>(null);
  const [isParsing, startParsing] = useTransition();
  const [isCommitting, startCommitting] = useTransition();

  // ── File handling ──────────────────────────────────────────────────────
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvContent(e.target?.result as string);
    };
    reader.readAsText(file);
  }, []);

  // ── Parse & Stage ─────────────────────────────────────────────────────
  const handleParse = () => {
    if (!csvContent.trim()) {
      toast.error("No CSV content", { description: "Upload a file or paste CSV data." });
      return;
    }

    startParsing(async () => {
      const idempotencyKey = `import-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result: StageImportResult = await stageImport(GROUP_ID, csvContent, idempotencyKey);

      if (!result.success) {
        toast.error("Import failed", { description: result.error ?? "Unknown error" });
        return;
      }

      setBatchId(result.batchId);
      setReport(result.report);
      setPhase("review");
      toast.success("CSV analyzed", {
        description: `${result.report?.totalRows} rows processed. ${result.report?.reviewCount} need review.`,
      });
    });
  };

  // ── Commit ────────────────────────────────────────────────────────────
  const handleCommit = (decisions: RowDecision[]) => {
    if (!batchId) return;

    startCommitting(async () => {
      const idempotencyKey = `commit-${batchId}-${Date.now()}`;
      const result = await commitImportBatch(batchId, decisions, idempotencyKey);

      if (!result.success) {
        toast.error("Commit failed", { description: result.error ?? "Unknown error" });
        return;
      }

      setCommitResult({ committed: result.committedCount, rejected: result.rejectedCount });
      setPhase("committed");
      toast.success("Import committed", {
        description: `${result.committedCount} expenses created. ${result.rejectedCount} rejected.`,
      });
    });
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">
        Import CSV
      </h1>
      <p className="mt-2 max-w-2xl leading-7 text-muted">
        Upload your expense CSV file. The system will parse, validate, and flag
        anomalies for your review before committing to the database.
      </p>

      {/* Phase indicator */}
      <div className="mt-6 flex items-center gap-2">
        {(["upload", "review", "committed"] as const).map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-line" />}
            <span
              className={`grid size-7 place-items-center rounded-full text-xs font-bold ${
                step === phase
                  ? "bg-indigo-action text-white"
                  : phase === "committed" || (phase === "review" && step === "upload")
                    ? "bg-sage-100 text-sage-700"
                    : "bg-canvas text-muted"
              }`}
            >
              {step === "upload" && phase !== "upload" ? (
                <CheckIcon className="size-3.5" />
              ) : step === "review" && phase === "committed" ? (
                <CheckIcon className="size-3.5" />
              ) : (
                i + 1
              )}
            </span>
            <span className="text-sm font-medium text-muted capitalize">{step}</span>
          </div>
        ))}
      </div>

      {/* Upload phase */}
      {phase === "upload" && (
        <div className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* File upload */}
            <div>
              <label htmlFor="csv-file" className="text-sm font-semibold text-ink">
                Upload CSV file
              </label>
              <div className="mt-2">
                <label
                  htmlFor="csv-file"
                  className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-line bg-canvas p-8 transition hover:border-sage-300 hover:bg-sage-50"
                >
                  <AuditIcon className="size-8 text-muted" />
                  <p className="mt-3 text-sm font-semibold text-ink">
                    {fileName ?? "Choose a file"}
                  </p>
                  <p className="mt-1 text-xs text-muted">CSV files only</p>
                  <input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Paste CSV */}
            <div>
              <label htmlFor="csv-paste" className="text-sm font-semibold text-ink">
                Or paste CSV content
              </label>
              <textarea
                id="csv-paste"
                value={csvContent}
                onChange={(e) => {
                  setCsvContent(e.target.value);
                  setFileName(null);
                }}
                placeholder="date,description,paid_by,amount,currency..."
                className="mt-2 h-48 w-full resize-none rounded-xl border border-line bg-canvas p-4 font-mono text-xs text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line pt-6">
            <p className="text-sm text-muted">
              {csvContent ? `${csvContent.split("\n").length - 1} data rows detected` : "No data loaded"}
            </p>
            <button
              type="button"
              onClick={handleParse}
              disabled={isParsing || !csvContent.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-action px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-hover disabled:cursor-wait disabled:opacity-60"
            >
              {isParsing ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Analyzing...
                </>
              ) : (
                <>
                  Parse & Analyze
                  <ArrowRightIcon className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Review phase */}
      {phase === "review" && report && (
        <div className="mt-8">
          {/* Summary bar */}
          <div className="mb-6 flex flex-wrap gap-3">
            <div className="rounded-xl border border-line bg-white px-4 py-2">
              <span className="text-xs font-medium text-muted">Total rows</span>
              <p className="text-lg font-bold text-ink">{report.totalRows}</p>
            </div>
            <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-2">
              <span className="text-xs font-medium text-sage-700">Clean</span>
              <p className="text-lg font-bold text-sage-700">{report.cleanCount}</p>
            </div>
            <div className="rounded-xl border border-amber-line bg-amber-soft px-4 py-2">
              <span className="text-xs font-medium text-amber-ink">Need review</span>
              <p className="text-lg font-bold text-amber-ink">{report.reviewCount}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2">
              <span className="text-xs font-medium text-red-700">Errors</span>
              <p className="text-lg font-bold text-red-700">{report.errorCount}</p>
            </div>
          </div>

          <ReviewTable
            rows={report.rows}
            onCommit={handleCommit}
            isCommitting={isCommitting}
          />
        </div>
      )}

      {/* Committed phase */}
      {phase === "committed" && commitResult && (
        <div className="mt-8 rounded-2xl border border-sage-200 bg-white p-8 text-center shadow-card">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-sage-100 text-sage-700">
            <CheckIcon className="size-8" />
          </span>
          <h2 className="mt-6 text-2xl font-semibold text-ink">Import committed</h2>
          <p className="mt-3 text-muted">
            {commitResult.committed} expense{commitResult.committed !== 1 ? "s" : ""} created
            {commitResult.rejected > 0 && `, ${commitResult.rejected} rejected`}.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a
              href="/dashboard/balances"
              className="rounded-xl bg-indigo-action px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-hover"
            >
              View balances
            </a>
            <button
              type="button"
              onClick={() => {
                setPhase("upload");
                setCsvContent("");
                setFileName(null);
                setBatchId(null);
                setReport(null);
                setCommitResult(null);
              }}
              className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
