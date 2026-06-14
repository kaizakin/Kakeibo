"use server";

import { prisma as db } from "@/src/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Group management actions
// ---------------------------------------------------------------------------

export async function createGroup(name: string) {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const group = await db.group.upsert({
    where: { id },
    update: { name },
    create: { id, name },
  });

  revalidatePath("/dashboard", "layout");
  return { success: true, groupId: group.id };
}

export async function switchGroup(groupId: string) {
  const cookieStore = await cookies();
  cookieStore.set("activeGroup", groupId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function getAvailableGroups() {
  return db.group.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: { memberships: true, expenses: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
