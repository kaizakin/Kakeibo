import { prisma as db } from "@/src/lib/db";
import { getGroupBalances, getSimplifiedDebts } from "@/src/app/actions/getBalances";
import { ArrowRightIcon } from "@/components/icons";
import Link from "next/link";

export const metadata = { title: "Balances" };

function formatPaise(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function BalancesPage() {
  const groupId = "pine-street-house";

  const [balanceResult, debtResult] = await Promise.all([
    getGroupBalances(groupId).catch(() => null),
    getSimplifiedDebts(groupId).catch(() => null),
  ]);

  const balances = balanceResult?.balances ?? [];

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">
        Balances
      </h1>
      <p className="mt-2 max-w-2xl leading-7 text-muted">
        Net positions for all members and simplified settlement plan.
      </p>

      {/* Net balances table */}
      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
          Net positions
        </h2>
        {balances.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <p className="text-sm text-muted">No expenses recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Member
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Net position
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {balances.map((b) => {
                  const isOwed = b.balanceInPaise > 0;
                  const isEven = b.balanceInPaise === 0;
                  return (
                    <tr
                      key={b.userId}
                      className="transition-colors hover:bg-canvas/40"
                    >
                      <td className="px-5 py-4 font-semibold text-ink">
                        {b.userName}
                      </td>
                      <td
                        className={`px-5 py-4 font-mono text-sm font-bold ${
                          isEven ? "text-muted" : isOwed ? "text-sage-700" : "text-amber-ink"
                        }`}
                      >
                        {isEven ? "—" : `${isOwed ? "+" : ""}${formatPaise(b.balanceInPaise)}`}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isEven
                              ? "bg-sage-100 text-sage-700"
                              : isOwed
                                ? "bg-sage-100 text-sage-700"
                                : "bg-amber-soft text-amber-ink"
                          }`}
                        >
                          {isEven
                            ? "Settled"
                            : isOwed
                              ? "To be paid"
                              : "Owes money"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Simplified debt transfers */}
      {debtResult && debtResult.transfers.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
            Settlement plan
          </h2>
          <p className="mb-4 text-sm leading-6 text-muted">
            To settle all debts with minimum transfers (
            {debtResult.transfers.length} transfer
            {debtResult.transfers.length !== 1 ? "s" : ""}):
          </p>

          <div className="space-y-3">
            {debtResult.transfers.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-line bg-white p-5 shadow-card"
              >
                <div className="flex items-center gap-4">
                  {/* From */}
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-amber-soft text-amber-ink text-sm font-bold">
                      {t.fromUserName.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {t.fromUserName}
                      </p>
                      <p className="text-xs text-muted">Pays</p>
                    </div>
                  </div>

                  <ArrowRightIcon className="size-5 text-muted shrink-0" />

                  {/* To */}
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-sage-100 text-sage-700 text-sm font-bold">
                      {t.toUserName.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {t.toUserName}
                      </p>
                      <p className="text-xs text-muted">Receives</p>
                    </div>
                  </div>
                </div>

                <span className="text-lg font-bold text-ink">
                  {formatPaise(t.amountInCents)}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-muted">
            Balances sum to zero across all members.{" "}
            <Link
              href="/dashboard/audit"
              className="font-semibold text-indigo-action hover:underline"
            >
              View audit trail →
            </Link>
          </p>
        </section>
      )}

      {/* Zero state */}
      {debtResult && debtResult.transfers.length === 0 && balances.length > 0 && (
        <section className="mt-8 rounded-2xl border border-sage-200 bg-sage-50 p-8 text-center">
          <p className="text-sm font-semibold text-sage-700">
            All balances are settled. No transfers needed.
          </p>
        </section>
      )}
    </div>
  );
}
