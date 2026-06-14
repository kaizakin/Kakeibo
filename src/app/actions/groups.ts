"use server";

import { prisma as db } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Group management actions
// ---------------------------------------------------------------------------

export async function createGroup(
  name: string,
  invitedEmails: string[],
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, groupId: null as string | null, error: "Not authenticated" };
  }

  const group = await db.group.create({
    data: { name },
  });

  // Add creator as ADMIN
  await db.groupMembership.create({
    data: {
      groupId: group.id,
      userId: session.user.id,
      role: "ADMIN",
      joinedAt: new Date(),
      leftAt: null,
    },
  });

  // Invite users by email — find existing or create placeholder
  for (const rawEmail of invitedEmails) {
    const email = rawEmail.trim().toLowerCase();
    if (!email) continue;

    let user = await db.user.findUnique({ where: { email } });

    if (!user) {
      // Create a placeholder user — they'll be claimed when they sign in with Google
      const placeholderName = email.split("@")[0];
      user = await db.user.create({
        data: { email, name: placeholderName },
      });
    }

    // Check for existing active membership
    const existing = await db.groupMembership.findFirst({
      where: { groupId: group.id, userId: user.id, leftAt: null },
    });

    if (!existing) {
      await db.groupMembership.create({
        data: {
          groupId: group.id,
          userId: user.id,
          role: "MEMBER",
          joinedAt: new Date(),
          leftAt: null,
        },
      });
    }
  }

  // Set active group cookie
  const cookieStore = await cookies();
  cookieStore.set("activeGroup", group.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/dashboard", "layout");
  return { success: true as const, groupId: group.id, error: null as string | null };
}

export async function switchGroup(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Not authenticated" };
  }

  // Verify the user is a member of this group
  const membership = await db.groupMembership.findFirst({
    where: { groupId, userId: session.user.id, leftAt: null },
  });

  if (!membership) {
    return { success: false as const, error: "You are not a member of this group" };
  }

  const cookieStore = await cookies();
  cookieStore.set("activeGroup", groupId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/dashboard", "layout");
  return { success: true as const };
}

export async function getUserGroups(userId: string) {
  const memberships = await db.groupMembership.findMany({
    where: { userId, leftAt: null },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { memberships: true, expenses: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    role: m.role,
    createdAt: m.group.createdAt,
    memberCount: m.group._count.memberships,
    expenseCount: m.group._count.expenses,
  }));
}
