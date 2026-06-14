import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma v7 with custom generator output (see schema.prisma) requires
// the adapter pattern for the generated PrismaClient.
import { PrismaClient } from "./generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set in .env file");
}

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Seed the database with the Pine Street House scenario.
 *
 * Users:
 *   - Aisha, Rohan, Priya: original housemates (Jan 1 2026 — present)
 *   - Meera: moved out Mar 31 2026
 *   - Sam: moved in Apr 8 2026
 *
 * The group is "Pine Street House".
 */
async function main() {
  console.log("🌱 Seeding database...");

  // ── Users ──────────────────────────────────────────────────────────────────
  const aisha = await prisma.user.upsert({
    where: { email: "aisha@pinestreet.example" },
    update: {},
    create: { name: "Aisha", email: "aisha@pinestreet.example" },
  });

  const rohan = await prisma.user.upsert({
    where: { email: "rohan@pinestreet.example" },
    update: {},
    create: { name: "Rohan", email: "rohan@pinestreet.example" },
  });

  const priya = await prisma.user.upsert({
    where: { email: "priya@pinestreet.example" },
    update: {},
    create: { name: "Priya", email: "priya@pinestreet.example" },
  });

  const meera = await prisma.user.upsert({
    where: { email: "meera@pinestreet.example" },
    update: {},
    create: { name: "Meera", email: "meera@pinestreet.example" },
  });

  const sam = await prisma.user.upsert({
    where: { email: "sam@pinestreet.example" },
    update: {},
    create: { name: "Sam", email: "sam@pinestreet.example" },
  });

  console.log("  ✓ Users created:", [aisha, rohan, priya, meera, sam].map((u) => u.name).join(", "));

  // ── Group ──────────────────────────────────────────────────────────────────
  const group = await prisma.group.upsert({
    where: { id: "pine-street-house" },
    update: {},
    create: {
      id: "pine-street-house",
      name: "Pine Street House",
      createdAt: new Date("2026-01-01T00:00:00+05:30"),
    },
  });

  console.log("  ✓ Group created:", group.name);

  // ── Memberships ────────────────────────────────────────────────────────────
  // Delete existing memberships for this group to avoid duplicates on re-seed
  await prisma.groupMembership.deleteMany({ where: { groupId: group.id } });

  const memberships = await Promise.all([
    // Aisha: Jan 1 2026, still active
    prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: aisha.id,
        joinedAt: new Date("2026-01-01T00:00:00+05:30"),
        leftAt: null,
      },
    }),
    // Rohan: Jan 1 2026, still active
    prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: rohan.id,
        joinedAt: new Date("2026-01-01T00:00:00+05:30"),
        leftAt: null,
      },
    }),
    // Priya: Jan 1 2026, still active
    prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: priya.id,
        joinedAt: new Date("2026-01-01T00:00:00+05:30"),
        leftAt: null,
      },
    }),
    // Meera: Jan 1 2026, LEFT Mar 31 2026
    prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: meera.id,
        joinedAt: new Date("2026-01-01T00:00:00+05:30"),
        leftAt: new Date("2026-03-31T23:59:59+05:30"),
      },
    }),
    // Sam: Joined Apr 8 2026 (his first expense date), still active
    prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: sam.id,
        joinedAt: new Date("2026-04-08T00:00:00+05:30"),
        leftAt: null,
      },
    }),
  ]);

  console.log(`  ✓ ${memberships.length} memberships created`);
  console.log("    - Meera left: 2026-03-31");
  console.log("    - Sam joined: 2026-04-08");
  console.log("\n✅ Seed complete!");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
