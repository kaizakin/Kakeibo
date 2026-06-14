"use client";

import { useState, useTransition } from "react";
import { removeUserFromGroup } from "@/src/app/actions/users";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface RemoveMemberButtonProps {
  membershipId: string;
  memberName: string;
}

export function RemoveMemberButton({
  membershipId,
  memberName,
}: RemoveMemberButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [leftDate, setLeftDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeUserFromGroup(membershipId, leftDate);
      if (result.success) {
        toast.success("Member removed", {
          description: `${memberName} has been marked as leaving on ${leftDate}.`,
        });
        setShowConfirm(false);
        router.refresh();
      } else {
        toast.error("Failed to remove member");
      }
    });
  };

  if (!showConfirm) {
    return (
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="rounded-lg px-3 py-1 text-xs font-semibold text-muted transition-colors hover:bg-red-50 hover:text-red-700"
      >
        Mark left
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={leftDate}
        onChange={(e) => setLeftDate(e.target.value)}
        className="w-32 rounded-lg border border-line bg-canvas px-2 py-1 text-xs text-ink outline-none"
      />
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "..." : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setShowConfirm(false)}
        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-canvas"
      >
        Cancel
      </button>
    </div>
  );
}
