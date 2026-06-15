/**
 * db:nuke — Delete all data from the database while preserving the schema.
 *
 * Usage:
 *   pnpm db:nuke
 *
 * Deletes rows from every table in foreign-key-safe order using Prisma model
 * operations (no raw SQL), so table naming is handled correctly.
 * Only data is removed; tables, indexes, constraints remain intact.
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Ensure .env exists and has DATABASE_URL.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function nuke() {
  console.log("💥 Nuking all data...");

  // Use Prisma model deleteMany() — this avoids raw SQL table naming issues
  // and respects the schema's `@@map` or default naming automatically.
  const deletions: { label: string; run: (tx: any) => Promise<{ count: number }> }[] = [
    { label: "ImportAnomaly",     run: (tx) => tx.importAnomaly.deleteMany() },
    { label: "ExpenseSplit",      run: (tx) => tx.expenseSplit.deleteMany() },
    { label: "Expense",           run: (tx) => tx.expense.deleteMany() },
    { label: "ImportRow",         run: (tx) => tx.importRow.deleteMany() },
    { label: "ImportBatch",       run: (tx) => tx.importBatch.deleteMany() },
    { label: "MutationKey",       run: (tx) => tx.mutationKey.deleteMany() },
    { label: "GroupMembership",   run: (tx) => tx.groupMembership.deleteMany() },
    { label: "Group",             run: (tx) => tx.group.deleteMany() },
    // NextAuth tables
    { label: "Session",           run: (tx) => tx.session.deleteMany() },
    { label: "Account",           run: (tx) => tx.account.deleteMany() },
    { label: "VerificationToken", run: (tx) => tx.verificationToken.deleteMany() },
    { label: "User",              run: (tx) => tx.user.deleteMany() },
  ];

  await prisma.$transaction(async (tx) => {
    for (const { label, run } of deletions) {
      const { count } = await run(tx);
      console.log(`  ✗ ${label}: ${count} row(s) deleted`);
    }
  });

  console.log("✅ All data nuked. Schema is intact.");
}

nuke()
  .catch((error) => {
    console.error("❌ Nuke failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
