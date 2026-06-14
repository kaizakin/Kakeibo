/**
 * Utility for reading/writing the active group ID via cookies.
 *
 * Server components call `getActiveGroup()` to get the currently selected
 * group ID. Client components use `switchActiveGroup()` to change it.
 */

import { cookies } from "next/headers";
import { prisma as db } from "@/src/lib/db";

const COOKIE_NAME = "activeGroup";
const DEFAULT_GROUP_ID = "pine-street-house";

/**
 * Read the active group ID from cookies.
 * Falls back to the default group ID if none is set.
 */
export async function getActiveGroup(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? DEFAULT_GROUP_ID;
}

/**
 * Read the active group ID from cookies and fetch the group name at the same time.
 */
export async function getActiveGroupWithName(): Promise<{
  groupId: string;
  groupName: string;
}> {
  const groupId = await getActiveGroup();

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
