"use server";

import { db } from "@/src/lib/db";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// User management actions
// ---------------------------------------------------------------------------

export async function getGroupMembers(groupId: string) {
  const memberships = await db.groupMembership.findMany({
    where: { groupId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    name: m.user.name ?? m.user.email,
    email: m.user.email,
    image: m.user.image,
    joinedAt: m.joinedAt.toISOString(),
    leftAt: m.leftAt?.toISOString() ?? null,
    isActive: m.leftAt === null || m.leftAt > new Date(),
  }));
}

export async function addUserToGroup(
  groupId: string,
  data: { name: string; email: string; joinedAt: string },
) {
  // Find or create the user
  let user = await db.user.findUnique({ where: { email: data.email } });

  if (!user) {
    user = await db.user.create({
      data: { name: data.name, email: data.email },
    });
  }

  // Check for existing active membership
  const existing = await db.groupMembership.findFirst({
    where: {
      groupId,
      userId: user.id,
      leftAt: null,
    },
  });

  if (existing) {
    return { success: false, error: "User already has an active membership in this group" };
  }

  await db.groupMembership.create({
    data: {
      groupId,
      userId: user.id,
      joinedAt: new Date(data.joinedAt),
      leftAt: null,
    },
  });

  revalidatePath("/dashboard/members");
  return { success: true, error: null };
}

export async function removeUserFromGroup(
  membershipId: string,
  leftAt: string,
) {
  await db.groupMembership.update({
    where: { id: membershipId },
    data: { leftAt: new Date(leftAt) },
  });

  revalidatePath("/dashboard/members");
  return { success: true };
}

export async function getAllGroups() {
  return db.group.findMany({
    include: {
      _count: { select: { memberships: true, expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGroupDetails(groupId: string) {
  return db.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { expenses: true, importBatches: true } },
    },
  });
}
