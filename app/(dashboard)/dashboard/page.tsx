import { prisma as db } from "@/src/lib/db";
import { getGroupBalances, getSimplifiedDebts } from "@/src/app/actions/getBalances";
import { getActiveGroupWithName } from "@/src/lib/active-group";
import Link from "next/link";
import {
  AuditIcon,
  CalendarIcon,
  CurrencyIcon,
  EyeIcon,
  PlusIcon,
  ArrowRightIcon,
} from "@/components/icons";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const activeGroup = await getActiveGroupWithName();

  if (!activeGroup) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <p className="text-sm text-muted">No group selected. Create or select a group to get started.</p>
      </div>
    );
  }

  const { groupId, groupName } = activeGroup;

  // Fetch data in parallel
  const [group, balanceResult, debtResult, importCount, expenseCount] =
    await Promise.all([
      db.group.findUnique({
        where: { id: groupId },
        include: {
          memberships: {
            include: { user: { select: { name: true } } },
          },
        },
      }),
      getGroupBalances(groupId).catch(() => null),
      getSimplifiedDebts(groupId).catch(() => null),
      db.importBatch.count({ where: { groupId, status: "REVIEW" } }),
      db.expense.count({ where: { groupId } }),
    ]);

  const activeMembers =
    group?.memberships.filter((m) => m.leftAt === null || m.leftAt > new Date())
      .length ?? 0;

  const summaryCards = [
    {
      label: "Total expenses",
      value: expenseCount.toString(),
      note: "Committed records",
      icon: EyeIcon,
      tone: "bg-indigo-soft text-indigo-action",
    },
    {
      label: "Active members",
      value: activeMembers.toString(),
      note: `of ${group?.memberships.length ?? 0} total`,
      icon: CalendarIcon,
      tone: "bg-sage-100 text-sage-700",
    },
    {
      label: "Pending imports",
      value: importCount.toString(),
      note: importCount > 0 ? "Awaiting review" : "All clear",
      icon: AuditIcon,
      tone: importCount > 0 ? "bg-amber-soft text-amber-ink" : "bg-sage-100 text-sage-700",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">
            Overview
          </h1>
          <p className="mt-2 max-w-2xl leading-7 text-muted">
            Financial summary for {groupName}.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/expenses"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-action px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-hover"
          >
            <PlusIcon className="size-4" />
            Add Expense
          </Link>
          <Link
            href="/dashboard/import"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-canvas"
          >
            Import CSV
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="rounded-2xl border border-line bg-white p-5 shadow-card"
            >
              <span className={`grid size-10 place-items-center rounded-xl ${card.tone}`}>
                <Icon className="size-4" />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                {card.value}
              </p>
              <p className="mt-1 text-sm text-muted">{card.note}</p>
            </article>
          );
        })}
      </div>

      {/* Simplified debts */}
      {debtResult && debtResult.transfers.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-card">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <p className="text-sm font-semibold text-ink">Settlement plan</p>
              <p className="mt-1 text-sm text-muted">
                Minimum {debtResult.transfers.length} transfer{debtResult.transfers.length !== 1 ? "s" : ""} to settle all debts
              </p>
            </div>
            <Link
              href="/dashboard/balances"
              className="text-sm font-semibold text-indigo-action hover:underline"
            >
              View details →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {debtResult.transfers.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-canvas p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-amber-soft text-amber-ink text-xs font-bold">
                    {t.fromUserName.charAt(0)}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {t.fromUserName}
                  </span>
                  <ArrowRightIcon className="size-4 text-muted" />
                  <span className="grid size-8 place-items-center rounded-lg bg-sage-100 text-sage-700 text-xs font-bold">
                    {t.toUserName.charAt(0)}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {t.toUserName}
                  </span>
                </div>
                <span className="text-sm font-bold text-ink">
                  ₹{(t.amountInCents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { href: "/dashboard/import", label: "Import CSV", desc: "Upload and review expense data" },
          { href: "/dashboard/balances", label: "Balances", desc: "View net positions and settlements" },
          { href: "/dashboard/audit", label: "Audit Trail", desc: "Trace every balance to its source" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift"
          >
            <p className="text-sm font-semibold text-ink">{link.label}</p>
            <p className="mt-2 text-sm text-muted">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
