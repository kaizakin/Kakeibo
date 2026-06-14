import { prisma as db } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { getActiveGroupWithName } from "@/src/lib/active-group";
import { ManualExpenseForm } from "./manual-expense-form";
import { PlusIcon } from "@/components/icons";

export const metadata = { title: "Add Expense" };

export default async function ExpensesPage() {
  const session = await auth();
  const activeGroup = await getActiveGroupWithName();

  if (!activeGroup) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <p className="text-sm text-muted">No group selected.</p>
      </div>
    );
  }

  const { groupId, groupName } = activeGroup;

  // Fetch active members for this group
  const memberships = await db.groupMembership.findMany({
    where: { groupId, leftAt: null },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });

  const members = memberships.map((m) => ({
    userId: m.user.id,
    name: m.user.name ?? m.user.email,
    email: m.user.email,
  }));

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <p className="text-sm text-muted">No members in this group yet. Add members first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-soft text-indigo-action">
          <PlusIcon className="size-6" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">
            Add Expense
          </h1>
          <p className="mt-1 max-w-2xl leading-7 text-muted">
            Record a new expense for <strong>{groupName}</strong>.
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card">
        <ManualExpenseForm groupId={groupId} members={members} />
      </div>
    </div>
  );
}
