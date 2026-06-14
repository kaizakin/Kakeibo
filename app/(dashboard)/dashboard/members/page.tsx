import { prisma as db } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { getGroupMembers } from "@/src/app/actions/users";
import { getActiveGroupWithName } from "@/src/lib/active-group";
import { getUserGroups } from "@/src/app/actions/groups";
import { AddMemberForm } from "./add-member-form";
import { RemoveMemberButton } from "./remove-member-button";
import { ShieldIcon, CalendarIcon } from "@/components/icons";

export const metadata = { title: "Members" };

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function MembersPage() {
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

  const [members, group, userGroups] = await Promise.all([
    getGroupMembers(groupId),
    db.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    }),
    session?.user?.id ? getUserGroups(session.user.id) : Promise.resolve([]),
  ]);

  // Check if the current user is an admin
  const currentUserGroup = userGroups.find((g) => g.id === groupId);
  const isAdmin = currentUserGroup?.role === "ADMIN";

  const activeMembers = members.filter((m) => m.isActive);
  const pastMembers = members.filter((m) => !m.isActive);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">
        Members
      </h1>
      <p className="mt-2 max-w-2xl leading-7 text-muted">
        Manage members of {group?.name ?? "your group"}. Add new users or mark
        existing ones as having left.
      </p>

      {/* Summary */}
      <div className="mt-8 flex flex-wrap gap-4">
        <div className="rounded-xl border border-line bg-white px-5 py-3 shadow-card">
          <p className="text-xs font-medium text-muted">Active members</p>
          <p className="mt-1 text-2xl font-bold text-ink">{activeMembers.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-white px-5 py-3 shadow-card">
          <p className="text-xs font-medium text-muted">Past members</p>
          <p className="mt-1 text-2xl font-bold text-muted">{pastMembers.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-white px-5 py-3 shadow-card">
          <p className="text-xs font-medium text-muted">Total</p>
          <p className="mt-1 text-2xl font-bold text-ink">{members.length}</p>
        </div>
      </div>

      {/* Active members */}
      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
          Active members
        </h2>
        {activeMembers.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <p className="text-sm text-muted">No active members.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Name
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Email
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Joined
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Role
                  </th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {activeMembers.map((m) => (
                  <tr
                    key={m.membershipId}
                    className="transition-colors hover:bg-canvas/40"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {m.image ? (
                          <img
                            src={m.image}
                            alt=""
                            className="size-8 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="grid size-8 place-items-center rounded-lg bg-sage-100 text-sage-700 text-xs font-bold">
                            {m.name.charAt(0)}
                          </span>
                        )}
                        <span className="font-semibold text-ink">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted">{m.email}</td>
                    <td className="px-5 py-4 font-mono text-xs text-muted">
                      {formatDate(m.joinedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-sage-700">
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {m.role === "ADMIN" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2.5 py-0.5 text-xs font-semibold text-amber-ink">
                          <ShieldIcon className="size-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Member</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {isAdmin && m.role !== "ADMIN" && (
                        <RemoveMemberButton
                          membershipId={m.membershipId}
                          memberName={m.name}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Past members */}
      {pastMembers.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
            Past members
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Name
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Email
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Joined
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Left
                  </th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pastMembers.map((m) => (
                  <tr
                    key={m.membershipId}
                    className="transition-colors hover:bg-canvas/40"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {m.image ? (
                          <img
                            src={m.image}
                            alt=""
                            className="size-8 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="grid size-8 place-items-center rounded-lg bg-sage-100 text-sage-700 text-xs font-bold">
                            {m.name.charAt(0)}
                          </span>
                        )}
                        <span className="font-semibold text-ink">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted">{m.email}</td>
                    <td className="px-5 py-4 font-mono text-xs text-muted">
                      {formatDate(m.joinedAt)}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-muted">
                      {m.leftAt ? formatDate(m.leftAt) : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-sage-50 px-2.5 py-0.5 text-xs font-semibold text-muted">
                        Left
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add member form — only visible to admins */}
      {isAdmin && (
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
            Add member
          </h2>
          <AddMemberForm groupId={groupId} />
        </section>
      )}
    </div>
  );
}
