"use client";

import { useState, useTransition } from "react";
import { addUserToGroup } from "@/src/app/actions/users";
import { ArrowRightIcon } from "@/components/icons";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AddMemberFormProps {
  groupId: string;
}

export function AddMemberForm({ groupId }: AddMemberFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [joinedAt, setJoinedAt] = useState(
    new Date().toISOString().split("T")[0],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !joinedAt) {
      toast.error("Please fill in all fields");
      return;
    }

    startTransition(async () => {
      const result = await addUserToGroup(groupId, {
        name: name.trim(),
        email: email.trim(),
        joinedAt,
      });

      if (result.success) {
        toast.success("Member added", {
          description: `${name.trim()} has been added to the group.`,
        });
        setName("");
        setEmail("");
        setJoinedAt(new Date().toISOString().split("T")[0]);
        router.refresh();
      } else {
        toast.error("Failed to add member", {
          description: result.error ?? "Unknown error",
        });
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-line bg-white p-5 shadow-card"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="member-name"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-muted"
          >
            Name
          </label>
          <input
            id="member-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya"
            className="mt-1.5 block w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
          />
        </div>
        <div>
          <label
            htmlFor="member-email"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-muted"
          >
            Email
          </label>
          <input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. priya@example.com"
            className="mt-1.5 block w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
          />
        </div>
        <div>
          <label
            htmlFor="member-joined"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-muted"
          >
            Joined date
          </label>
          <input
            id="member-joined"
            type="date"
            value={joinedAt}
            onChange={(e) => setJoinedAt(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-action px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-hover disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              Adding...
            </>
          ) : (
            <>
              Add member
              <ArrowRightIcon className="size-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
