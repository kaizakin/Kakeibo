import { db } from "@/src/lib/db";
import { getExpensesAudit } from "@/src/app/actions/getBalances";
import { UserSelector } from "./user-selector";
import { CalendarIcon } from "@/components/icons";

export const metadata = { title: "Audit Trail" };

function formatPaise(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const sign = paise < 0 ? "−" : "";
  return `${sign}₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const groupId = "pine-street-house";
  const params = await searchParams;
  const selectedUserId = params.userId ?? null;

  // Fetch all group members for the user selector
  const memberships = await db.groupMembership.findMany({
    where: { groupId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  // Deduplicate by user
  const userMap = new Map<string, { id: string; name: string; email: string }>();
  for (const m of memberships) {
    if (!userMap.has(m.user.id)) {
      userMap.set(m.user.id, { id: m.user.id, name: m.user.name ?? m.user.email, email: m.user.email });
    }
  }
  const users = Array.from(userMap.values());

  // Determine which user to show (default to first)
  const effectiveUserId = selectedUserId ?? users[0]?.id ?? null;

  // Fetch audit trail for selected user
  const auditResult = effectiveUserId
    ? await getExpensesAudit(groupId, effectiveUserId).catch(() => null)
    : null;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">
        Audit Trail
      </h1>
      <p className="mt-2 max-w-2xl leading-7 text-muted">
        Chronological breakdown of every expense that affected a member&apos;s
        balance, with running totals.
      </p>

      {/* User selector */}
      <div className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-card">
        <label htmlFor="user-select" className="text-sm font-semibold text-ink">
          Select member
        </label>
        <div className="mt-2 flex items-center gap-3">
          <UserSelector users={users} selectedUserId={selectedUserId} />
          {auditResult && (
            <span className="text-sm text-muted">
              <strong className="text-ink">{auditResult.entries.length}</strong> entries
            </span>
          )}
        </div>
      </div>

      {/* Audit trail table */}
      {auditResult && auditResult.entries.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60">
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  Date
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  Description
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  Role
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  Amount
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  Running balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {auditResult.entries.map((entry, i) => (
                <tr
                  key={`${entry.expenseId}-${entry.role}-${i}`}
                  className="transition-colors hover:bg-canvas/40"
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-muted">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-ink">
                      {entry.description}
                    </span>
                    {entry.currency !== "INR" && (
                      <span className="ml-2 rounded bg-amber-soft px-1.5 py-0.5 text-xs font-medium text-amber-ink">
                        {entry.currency}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        entry.role === "PAYER"
                          ? "bg-sage-100 text-sage-700"
                          : "bg-indigo-soft text-indigo-action"
                      }`}
                    >
                      {entry.role === "PAYER" ? "Paid" : "Owes"}
                    </span>
                  </td>
                  <td
                    className={`px-5 py-3.5 font-mono text-sm font-bold ${
                      entry.role === "PAYER" ? "text-sage-700" : "text-amber-ink"
                    }`}
                  >
                    {entry.role === "PAYER" ? "+" : ""}
                    {formatPaise(entry.amountInPaiseInr)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-sm font-bold text-ink">
                    {formatPaise(entry.runningBalanceInPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary footer */}
          <div className="border-t border-line bg-canvas/40 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">
                Final balance for {auditResult.userName}
              </span>
              <span
                className={`font-mono text-lg font-bold ${
                  auditResult.finalBalanceInPaise >= 0
                    ? "text-sage-700"
                    : "text-amber-ink"
                }`}
              >
                {auditResult.finalBalanceInPaise >= 0 ? "+" : ""}
                {formatPaise(auditResult.finalBalanceInPaise)}
              </span>
            </div>
          </div>
        </div>
      ) : auditResult ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-canvas">
            <CalendarIcon className="size-5 text-muted" />
          </span>
          <p className="mt-4 text-sm font-semibold text-ink">
            No expenses found
          </p>
          <p className="mt-1 text-sm text-muted">
            {auditResult.userName} has no recorded expenses in this group.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-white p-8 text-center">
          <p className="text-sm text-muted">Select a member to view their audit trail.</p>
        </div>
      )}

      {/* Explanation */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          How to read this
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sage-400" />
            <span>
              <strong className="text-ink">Payer (Paid):</strong> This user paid
              for the expense out of pocket. The amount is added to their
              balance — they are owed this money.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-action" />
            <span>
              <strong className="text-ink">Participant (Owes):</strong> This user
              owes their share of the expense. The amount is subtracted from
              their balance.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
            <span>
              <strong className="text-ink">Running balance:</strong> Cummulative
              total after each expense. A positive number means the group owes
              this user money.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
