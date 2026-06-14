import type { ReactNode } from "react";
import { auth } from "@/src/lib/auth";
import { prisma as db } from "@/src/lib/db";
import { getActiveGroup } from "@/src/lib/active-group";
import { getUserGroups } from "@/src/app/actions/groups";
import { GroupSwitcher } from "@/components/group-switcher";
import { DashboardNav } from "@/components/dashboard-nav";
import { ShieldIcon } from "@/components/icons";
import { CreateFirstGroup } from "@/components/create-first-group";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <p className="text-muted">Please sign in to access the dashboard.</p>
      </div>
    );
  }

  // Fetch the user's groups (only groups they are a member of)
  const userGroups = await getUserGroups(userId);

  // If user has no groups, show the create-first-group UI
  if (userGroups.length === 0) {
    return <CreateFirstGroup />;
  }

  // Determine active group
  const cookieGroupId = await getActiveGroup();
  const activeGroupId = cookieGroupId && userGroups.some((g) => g.id === cookieGroupId)
    ? cookieGroupId
    : userGroups[0].id;

  const activeGroup = userGroups.find((g) => g.id === activeGroupId);
  const activeGroupName = activeGroup?.name ?? "My Group";

  const groups = userGroups.map((g) => ({
    id: g.id,
    name: g.name,
    role: g.role,
    memberCount: g.memberCount,
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
            activeGroupId={activeGroupId}
            activeGroupName={activeGroupName}
            groups={groups}
          />

          {/* Navigation */}
          <DashboardNav />
        </div>
      </aside>
      <div className="min-w-0 flex-1 flex flex-col items-start">
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
