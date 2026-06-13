---
name: ledger-transactions
description: Use this skill when writing Next.js Server Actions or API routes that mutate group balances, settle debts, or add entries to the ledger.
---

# Ledger Transaction & Concurrency Protocol

Every balance modification must happen inside an atomic database transaction. Never read a balance, modify it in application logic, and write it back non-atomically.

## Rules
1. **Strict Isolation:** Use database transactions (`BEGIN` / `COMMIT`).
2. **Row Locking:** When reading a group's current total balance sheet to append a new expense, utilize row-level locking (`SELECT ... FOR UPDATE` or Prisma's interactive transactions) to block concurrent updates until the current write finishes.
3. **Idempotency:** Every mutation request must accept an `idempotencyKey` from the client to prevent double-submitting a bill if a user double-clicks the "Submit" button on a flaky mobile network.