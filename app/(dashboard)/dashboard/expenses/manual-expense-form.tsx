"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createExpense, type CreateExpenseInput } from "@/src/app/actions/createExpense";
import { ArrowRightIcon, PlusIcon } from "@/components/icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Member = {
  userId: string;
  name: string;
  email: string;
};

interface ManualExpenseFormProps {
  groupId: string;
  members: Member[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManualExpenseForm({ members: allMembers, groupId }: ManualExpenseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [payerId, setPayerId] = useState(allMembers[0]?.userId ?? "");
  const [amount, setAmount] = useState(""); // In major units
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [splitType, setSplitType] = useState<"EQUAL" | "EXACT">("EQUAL");

  // Selected participants (default: all members except payer, or all if none selected)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(allMembers.map((m) => m.userId)),
  );

  // Manual split amounts keyed by userId (for EXACT mode)
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});

  // Derived values
  const amountInCents = Math.round(parseFloat(amount || "0") * 100);
  const selectedMembers = allMembers.filter((m) => selectedIds.has(m.userId));
  const isPayerSelected = payerId && selectedIds.has(payerId);
  const equalShare = selectedMembers.length > 0
    ? Math.floor(amountInCents / selectedMembers.length)
    : 0;
  const remainder = selectedMembers.length > 0
    ? amountInCents % selectedMembers.length
    : 0;

  // Computed splits
  const equalSplits = selectedMembers.map((m, i) => ({
    userId: m.userId,
    owedAmountInCents: equalShare + (i < remainder ? 1 : 0),
  }));

  // Toggle a member for splitting
  const toggleMember = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  // Toggle all members
  const toggleAll = useCallback(() => {
    if (selectedIds.size === allMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allMembers.map((m) => m.userId)));
    }
  }, [allMembers]);

  // Resolve final splits
  const resolvedSplits =
    splitType === "EQUAL"
      ? equalSplits
      : selectedMembers.map((m) => ({
          userId: m.userId,
          owedAmountInCents: Math.round(parseFloat(manualAmounts[m.userId] || "0") * 100),
        }));

  const resolvedTotal = resolvedSplits.reduce((s, v) => s + v.owedAmountInCents, 0);
  const splitMatchesTotal = resolvedTotal === amountInCents;

  // Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!payerId) {
      toast.error("Please select who paid");
      return;
    }
    if (!amount || amountInCents <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error("Please select at least one person to split with");
      return;
    }
    if (!splitMatchesTotal) {
      toast.error(
        splitType === "EQUAL"
          ? "Split amounts don't match the total. Try adjusting the amount."
          : `Split amounts (₹${(resolvedTotal / 100).toFixed(2)}) must equal the total (₹${(amountInCents / 100).toFixed(2)})`,
      );
      return;
    }

    const payload: CreateExpenseInput = {
      paidByUserId: payerId,
      amountInCents,
      currency,
      description: description.trim(),
      date,
      splitType,
      splits: resolvedSplits,
      idempotencyKey: generateIdempotencyKey(),
    };

    startTransition(async () => {
      const result = await createExpense(payload);

      if (result.success) {
        toast.success("Expense added", {
          description: `${description.trim()} — ₹${(amountInCents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        });
        // Reset form
        setAmount("");
        setDescription("");
        setDate(new Date().toISOString().split("T")[0]);
        setSplitType("EQUAL");
        setManualAmounts({});
        router.refresh();
      } else {
        toast.error("Failed to add expense", {
          description: result.error ?? "Unknown error",
        });
      }
    });
  };

  const fmtCents = (cents: number) =>
    `₹${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Payer + Amount + Currency ───────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Payer */}
        <div>
          <label
            htmlFor="expense-payer"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-muted"
          >
            Paid by
          </label>
          <select
            id="expense-payer"
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
          >
            {allMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label
            htmlFor="expense-amount"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-muted"
          >
            Amount
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
              {currency === "INR" ? "₹" : "$"}
            </span>
            <input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="block w-full rounded-xl border border-line bg-canvas px-4 py-2.5 pl-8 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
            />
          </div>
        </div>

        {/* Currency */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            Currency
          </label>
          <div className="mt-1.5 flex overflow-hidden rounded-xl border border-line bg-canvas">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold transition ${
                currency === "INR"
                  ? "bg-indigo-action text-white"
                  : "text-muted hover:bg-gray-50"
              }`}
            >
              INR
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold transition ${
                currency === "USD"
                  ? "bg-indigo-action text-white"
                  : "text-muted hover:bg-gray-50"
              }`}
            >
              USD
            </button>
          </div>
        </div>
      </div>

      {/* ── Description ─────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="expense-description"
          className="text-xs font-semibold uppercase tracking-[0.1em] text-muted"
        >
          Description
        </label>
        <input
          id="expense-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Dinner at Olive Garden"
          className="mt-1.5 block w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
        />
      </div>

      {/* ── Date ────────────────────────────────────────────────────────── */}
      <div className="max-w-xs">
        <label
          htmlFor="expense-date"
          className="text-xs font-semibold uppercase tracking-[0.1em] text-muted"
        >
          Date
        </label>
        <input
          id="expense-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
        />
      </div>

      {/* ── Split type ──────────────────────────────────────────────────── */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
          Split type
        </label>
        <div className="mt-1.5 flex gap-3">
          <button
            type="button"
            onClick={() => setSplitType("EQUAL")}
            className={`rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${
              splitType === "EQUAL"
                ? "border-indigo-action bg-indigo-action/5 text-indigo-action"
                : "border-line text-muted hover:border-gray-300 hover:text-ink"
            }`}
          >
            Equal split
          </button>
          <button
            type="button"
            onClick={() => setSplitType("EXACT")}
            className={`rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${
              splitType === "EXACT"
                ? "border-indigo-action bg-indigo-action/5 text-indigo-action"
                : "border-line text-muted hover:border-gray-300 hover:text-ink"
            }`}
          >
            Custom amounts
          </button>
        </div>
      </div>

      {/* ── Participants ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            Split with ({selectedMembers.length} of {allMembers.length})
          </label>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-semibold text-indigo-action hover:underline"
          >
            {selectedIds.size === allMembers.length ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className="mt-2 space-y-1 rounded-xl border border-line bg-white p-2 shadow-card">
          {allMembers.map((m) => {
            const checked = selectedIds.has(m.userId);
            const share =
              splitType === "EQUAL"
                ? equalSplits.find((s) => s.userId === m.userId)?.owedAmountInCents ?? 0
                : Math.round(parseFloat(manualAmounts[m.userId] || "0") * 100);

            return (
              <label
                key={m.userId}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-canvas ${
                  checked ? "" : "opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMember(m.userId)}
                  className="size-4 rounded border-line text-indigo-action focus:ring-indigo-action/20"
                />
                <span className="grid size-7 place-items-center rounded-lg bg-sage-100 text-xs font-bold text-sage-700">
                  {m.name.charAt(0)}
                </span>
                <span className="flex-1 text-sm font-medium text-ink">{m.name}</span>

                {checked && splitType === "EXACT" && (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={manualAmounts[m.userId] ?? ""}
                      onChange={(e) =>
                        setManualAmounts((prev) => ({
                          ...prev,
                          [m.userId]: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                      className="w-28 rounded-lg border border-line bg-canvas px-2.5 py-1.5 pl-6 text-right text-sm font-mono text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {checked && splitType === "EQUAL" && share > 0 && (
                  <span className="text-sm font-mono font-semibold text-muted">
                    {fmtCents(share)}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {/* Split summary */}
        {selectedMembers.length > 0 && amountInCents > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-canvas px-4 py-2.5 text-sm">
            <span className="text-muted">
              {splitType === "EQUAL"
                ? `${selectedMembers.length} × ${fmtCents(equalShare)}`
                : `${selectedMembers.length} participant${selectedMembers.length > 1 ? "s" : ""}`}
              {!splitMatchesTotal && (
                <span className="ml-2 text-xs text-red-500">
                  (total: {fmtCents(resolvedTotal)})
                </span>
              )}
            </span>
            <span className="font-semibold text-ink">Total: {fmtCents(amountInCents)}</span>
          </div>
        )}
      </div>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 border-t border-line pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-muted transition hover:border-gray-300 hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-action px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-hover disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              Adding...
            </>
          ) : (
            <>
              <PlusIcon className="size-4" />
              Add expense
            </>
          )}
        </button>
      </div>
    </form>
  );
}
