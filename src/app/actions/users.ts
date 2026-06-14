"use server";

import { prisma as db } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
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
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });

  return memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    name: m.user.name ?? m.user.email,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
    leftAt: m.leftAt?.toISOString() ?? null,
    isActive: m.leftAt === null || m.leftAt > new Date(),
  }));
}

export async function addUserToGroup(
  groupId: string,
  data: { name: string; email: string; joinedAt: string },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify the caller is an admin of this group
  const callerMembership = await db.groupMembership.findFirst({
    where: { groupId, userId: session.user.id, leftAt: null, role: "ADMIN" },
  });

  if (!callerMembership) {
    return { success: false, error: "Only group admins can add members" };
  }

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
      role: "MEMBER",
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
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the membership to find the group
  const membership = await db.groupMembership.findUnique({
    where: { id: membershipId },
    select: { groupId: true, userId: true, role: true },
  });

  if (!membership) {
    return { success: false, error: "Membership not found" };
  }

  // Verify the caller is an admin of this group
  const callerMembership = await db.groupMembership.findFirst({
    where: { groupId: membership.groupId, userId: session.user.id, leftAt: null, role: "ADMIN" },
  });

  if (!callerMembership) {
    return { success: false, error: "Only group admins can remove members" };
  }

  // Cannot remove the last admin
  if (membership.role === "ADMIN") {
    const adminCount = await db.groupMembership.count({
      where: { groupId: membership.groupId, leftAt: null, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return { success: false, error: "Cannot remove the last admin. Promote another member first." };
    }
  }

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
