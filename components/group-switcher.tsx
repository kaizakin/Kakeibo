"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { switchGroup, createGroup } from "@/src/app/actions/groups";

interface GroupInfo {
  id: string;
  name: string;
  role: string;
  memberCount: number;
}

interface GroupSwitcherProps {
  activeGroupId: string;
  activeGroupName: string;
  groups: GroupInfo[];
}

export function GroupSwitcher({ activeGroupId, activeGroupName, groups }: GroupSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreating, startCreating] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [invitedEmails, setInvitedEmails] = useState<string[]>([""]);

  const handleSwitch = useCallback(
    (groupId: string) => {
      if (groupId === activeGroupId) return;
      startTransition(async () => {
        await switchGroup(groupId);
        router.refresh();
      });
    },
    [activeGroupId, router],
  );

  const handleCreate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newGroupName.trim()) return;
      const validEmails = invitedEmails
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      startCreating(async () => {
        await createGroup(newGroupName.trim(), validEmails);
        setNewGroupName("");
        setInvitedEmails([""]);
        setShowCreate(false);
        router.refresh();
      });
    },
    [newGroupName, invitedEmails, router],
  );

  return (
    <div className="mb-3">
      {/* Active group display */}
      <div className="mb-2 rounded-xl bg-canvas p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">Active group</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink">
              {activeGroupName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-sage-100 hover:text-ink"
            title="Create new group"
          >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Create group form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-2 rounded-xl border border-line bg-white p-3">
          <label htmlFor="new-group-name" className="text-xs font-semibold text-muted">
            New group name
          </label>
          <input
            id="new-group-name"
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g. Beach Trip 2026"
            className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
            autoFocus
          />

          <label className="mt-3 block text-xs font-semibold text-muted">
            Invite by email
          </label>
          <div className="mt-1.5 space-y-1.5">
            {invitedEmails.map((email, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setInvitedEmails((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    });
                  }}
                  placeholder="e.g. priya@example.com"
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink outline-none transition focus:border-indigo-action focus:ring-2 focus:ring-indigo-action/10"
                />
                {invitedEmails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setInvitedEmails((prev) => prev.filter((_, idx) => idx !== i))}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700"
                  >
                    <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setInvitedEmails((prev) => [...prev, ""])}
              className="text-xs font-semibold text-indigo-action hover:underline"
            >
              + Add another
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={isCreating || !newGroupName.trim()}
              className="rounded-lg bg-indigo-action px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-hover disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewGroupName("");
                setInvitedEmails([""]);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-canvas"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Group list */}
      {groups.length > 1 && (
        <div className="space-y-0.5">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleSwitch(g.id)}
              disabled={isPending}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                g.id === activeGroupId
                  ? "bg-sage-100 text-sage-800"
                  : "text-muted hover:bg-sage-50 hover:text-ink"
              } disabled:opacity-50`}
            >
              <span className="shrink-0 grid size-5 place-items-center rounded bg-sage-200 text-[10px] font-bold text-sage-800">
                {g.name.charAt(0)}
              </span>
              <span className="truncate">{g.name}</span>
              <span className="ml-auto shrink-0 flex items-center gap-1.5">
                {g.role === "ADMIN" && (
                  <span className="text-[10px] font-semibold text-amber-600" title="Admin">
                    ★
                  </span>
                )}
                <span className="text-[10px] text-muted">{g.memberCount}</span>
              </span>
              {g.id === activeGroupId && (
                <span className="size-1.5 rounded-full bg-indigo-action shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
