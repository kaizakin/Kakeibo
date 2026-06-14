"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface UserSelectorProps {
  users: UserOption[];
  selectedUserId: string | null;
}

export function UserSelector({ users, selectedUserId }: UserSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (userId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("userId", userId);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="mt-2 flex items-center gap-3">
      <select
        id="user-select"
        className="block w-full max-w-xs rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-action focus:bg-white focus:ring-4 focus:ring-indigo-action/10"
        value={selectedUserId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.email})
          </option>
        ))}
      </select>
    </div>
  );
}
