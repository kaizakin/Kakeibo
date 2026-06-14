# Technical Decision Log

This document records the major technical decisions made while building Kakeibo, why they were made, and what alternatives were considered.

---

### 1. Financial Math & Precision

###### Problem

JavaScript uses floating-point numbers for decimals, which can produce unexpected results:

```js
0.1 + 0.2 // 0.30000000000000004
```

For a finance-related application, even small rounding errors can eventually lead to incorrect balances.

###### Options Considered

* Use JavaScript `Number` and round values before displaying them.
* Use a decimal library such as `decimal.js`.
* Store money as integers (paise/cents) and perform all calculations using integer arithmetic.

###### Decision

Store all monetary values as integers.

###### Why

Using integers completely avoids floating-point precision issues and keeps calculations predictable. Every expense, split, settlement, and balance calculation is performed using integer values. To make sure this rule wasn't accidentally broken during development, I also created a dedicated AI skill that instructs coding agents to always treat money as integers.

---

### 2. Prisma Driver & Database Connections

###### Problem

During the initial setup, database migrations were failing because Prisma was not configured correctly for the version being used and the datasource configuration was incorrect.

###### Options Considered

* Downgrade to an older Prisma version and use the traditional query engine.
* Upgrade to the latest Prisma version and use the newer PostgreSQL adapter approach.

###### Decision

Use Prisma v7.8.0 together with `@prisma/adapter-pg`.

###### Why

Prisma is moving toward native driver adapters, which reduces the need for large query engine binaries and works better in modern environments like Next.js. A singleton Prisma client was also implemented to prevent unnecessary database connections during development and hot reloads.

---

### 3. Group Membership Validation

###### Problem

Expense records should only involve people who were actually part of a group when the expense occurred.

###### Decision

Validate group membership against the expense date.

###### Why

When importing or creating expenses, the system checks whether every participant was an active member of the group at that point in time. If someone was never part of the group or had already left, the record is flagged for review. This prevents invalid participants from affecting balances.

To reinforce this model, new users are required to create or join a group before accessing the main application.

---

### 4. CSV Review Phase & Anomaly Detection

###### Problem

CSV exports from banks and other platforms are often inconsistent and may contain incomplete or invalid data.

###### Options Considered

* Import everything directly.
* Reject files containing any errors.
* Review imported data before saving it.

###### Decision

Use a two-step import process with anomaly detection and a review screen.

###### Why

Imported data is first analyzed before anything is written to the database. The system checks for common issues such as zero-value transactions, invalid participants, and incorrect split percentages.

Instead of rejecting the entire file, potential issues are shown to the user during a review step. Users can fix problems before importing the data. Any edits that affect calculations trigger re-validation to ensure only valid data is saved.

---

### 5. Audit Trail & Manual Expense Entry

###### Problem

Users need to understand how balances change over time.

###### Decision

Maintain an audit trail for every financial event and support manual expense creation.

###### Why

CSV imports are useful for bulk data, but users also need a way to record expenses manually. Regardless of how an expense is added, it is recorded in the ledger.

The audit trail allows users to trace balance changes back to the original transactions, making it easier to understand how the current state was reached.

---

### 6. Currency Normalization

###### Problem

Groups may contain expenses recorded in different currencies.

###### Decision

Convert everything into INR before storing balance-related data.

###### Why

Supporting multiple currencies throughout the ledger would significantly increase complexity. Instead, foreign currency transactions are converted during ingestion, and all balance calculations use INR as the base currency.

This keeps calculations consistent and makes balances easier for users to understand.

---

### 7. Dynamic Balance Calculation

###### Problem

Balances can either be stored in the database or calculated when needed.

###### Options Considered

* Store balances as a derived field.
* Calculate balances directly from ledger data.

###### Decision

Calculate balances dynamically.

###### Why

Stored balances can become inaccurate if records are edited, deleted, or partially updated. By treating expenses, splits, and settlements as the source of truth, balances can always be recalculated from actual ledger data.

This approach trades some computation for better consistency and reliability.

---

### 8. Database Transactions for Financial Operations

###### Problem

Creating an expense involves multiple database operations that must either all succeed or all fail.

###### Decision

Use Prisma transactions for all multi-step financial operations.

###### Why

Creating an expense may involve creating the expense record, participant splits, settlement records, and audit entries. If one step fails while others succeed, the database can become inconsistent.

Wrapping these operations in a transaction ensures that either everything is committed or nothing is.

---

### 9. Server Actions Instead of API Routes

###### Problem

Next.js supports both API routes and Server Actions for handling data mutations.

###### Decision

Use Server Actions wherever possible.

###### Why

Server Actions reduce boilerplate and allow forms to communicate directly with server-side logic. They also provide end-to-end TypeScript safety and integrate naturally with Next.js caching and revalidation.

For operations such as group creation, expense creation, imports, and settlements, Server Actions provided a simpler and cleaner architecture than maintaining separate API endpoints.
