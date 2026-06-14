"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "@/src/app/actions/groups";
import { BrandMark } from "@/components/brand-mark";
import { ArrowRightIcon, PlusIcon } from "@/components/icons";
import { toast } from "sonner";

export function CreateFirstGroup() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [groupName, setGroupName] = useState("");
  const [emails, setEmails] = useState<string[]>([""]);

  const addEmailField = () => {
    setEmails((prev) => [...prev, ""]);
  };

  const removeEmailField = (index: number) => {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    setEmails((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }

    const validEmails = emails
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createGroup(groupName.trim(), validEmails);

      if (result.success) {
        toast.success("Group created", {
          description: `${groupName.trim()} has been created with ${validEmails.length} invited member${validEmails.length !== 1 ? "s" : ""}.`,
        });
        router.refresh();
      } else {
        toast.error("Failed to create group", {
          description: result.error ?? "Unknown error",
        });
      }
    });
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 lg:py-20">
      <div className="w-full max-w-lg">
        {/* Centered brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <BrandMark />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9353d3]">
            Welcome to Kakeibo
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-[#1a1a1a]">
            Create your first group
          </h2>
          <p className="mx-auto mt-3 max-w-sm leading-7 text-gray-500">
            Groups are private. Only people you invite can see and access
            the group&apos;s expenses and balances.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
        >
          {/* Group name */}
          <div>
            <label
              htmlFor="group-name"
              className="text-xs font-semibold uppercase tracking-[0.1em] text-muted"
            >
              Group name
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Pine Street House"
              className="mt-1.5 block w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
              autoFocus
            />
          </div>

          {/* Invited emails */}
          <div className="mt-6">
            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
              Invite members
            </label>
            <p className="mt-1 text-xs leading-5 text-muted">
              Add the email addresses of people you want to invite. They&apos;ll see this group when they sign in.
            </p>

            <div className="mt-3 space-y-2">
              {emails.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    placeholder="e.g. priya@example.com"
                    className="block w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
                  />
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailField(index)}
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-red-50 hover:text-red-700"
                      title="Remove email"
                    >
                      <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addEmailField}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-action transition-colors hover:text-indigo-hover"
            >
              <PlusIcon className="size-4" />
              Add another email
            </button>
          </div>

          {/* Submit */}
          <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
            <p className="text-xs text-muted">
              You&apos;ll be the group admin
            </p>
            <button
              type="submit"
              disabled={isPending || !groupName.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-action px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-hover disabled:cursor-wait disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Creating...
                </>
              ) : (
                <>
                  Create group
                  <ArrowRightIcon className="size-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
