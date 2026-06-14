/**
 * Utility for reading/writing the active group ID via cookies.
 *
 * Server components call `getActiveGroup()` to get the currently selected
 * group ID. Client components use `switchActiveGroup()` to change it.
 *
 * If the user has no groups, returns null.
 */

import { cookies } from "next/headers";
import { prisma as db } from "@/src/lib/db";

const COOKIE_NAME = "activeGroup";

/**
 * Read the active group ID from cookies.
 * Returns null if no group is set or the group no longer exists.
 */
export async function getActiveGroup(): Promise<string | null> {
  const cookieStore = await cookies();
  const groupId = cookieStore.get(COOKIE_NAME)?.value;
  if (!groupId) return null;

  // Verify the group still exists
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });

  return group?.id ?? null;
}

/**
 * Read the active group ID from cookies and fetch the group name at the same time.
 * Returns null for both if no group is active.
 */
export async function getActiveGroupWithName(): Promise<{
  groupId: string;
  groupName: string;
} | null> {
  const groupId = await getActiveGroup();

  if (!groupId) return null;

  const group = await db.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });

  const fallbackName = groupId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    groupId,
    groupName: group?.name ?? fallbackName,
  };
}
