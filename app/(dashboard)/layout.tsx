import type { ReactNode } from "react";
import { auth } from "@/src/lib/auth";
import { prisma as db } from "@/src/lib/db";
import { getActiveGroup } from "@/src/lib/active-group";
import { GroupSwitcher } from "@/components/group-switcher";
import { DashboardNav } from "@/components/dashboard-nav";
import { ShieldIcon } from "@/components/icons";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const groupId = await getActiveGroup();

  // Fetch group info and all available groups
  const [activeGroup, allGroups] = await Promise.all([
    db.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    }),
    db.group.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeGroupName = activeGroup?.name ?? groupId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const groups = allGroups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g._count.memberships,
  }));

  return (
    <div className="flex flex-1 gap-6 px-4 py-6 lg:px-8 lg:py-8 w-full max-w-[100vw]">
      <aside className="hidden w-60 shrink-0 lg:block lg:mr-8">
        <div className="sticky top-24 rounded-2xl border border-line bg-white p-3 shadow-card">
          {/* User info */}
          {session?.user && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="size-9 rounded-xl object-cover"
                />
              ) : (
                <span className="grid size-9 place-items-center rounded-xl bg-gray-200 text-gray-800">
                  <ShieldIcon className="size-4" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {session.user.name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted">
                  {session.user.email}
                </p>
              </div>
            </div>
          )}

          {/* Group switcher */}
          <GroupSwitcher
            activeGroupId={groupId}
            activeGroupName={activeGroupName}
            groups={groups}
          />

          {/* Navigation */}
          <DashboardNav />
        </div>
      </aside>
      <div className="min-w-0 flex-1 flex flex-col items-center">
        <div className="w-full max-w-[1200px]">
          {children}
        </div>
      </div>
    </div>
  );
}
