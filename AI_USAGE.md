# AI Usage & Corrections Log

## AI Tools Used

I used a combination of AI tools throughout development, but primarily as accelerators rather than letting them make architectural decisions on their own.

* **Codex & Claude Sonnet 4.6** were used to scaffold the initial backend structure, generate Prisma models, set up routes, and help implement the first version of the expense-tracking workflow.

* **Antigravity with Gemini 3.1** was used mostly on the frontend side. It helped with layouts, Tailwind styling, responsive tables, and a lot of the UI refinements.

* **DeepSeek V4 Flash** was used as a day-to-day pair programmer for quick refactors, debugging, and smaller implementation tasks.

generated code was rarely production-ready on the first attempt. A significant amount of time was spent reviewing outputs, fixing incorrect assumptions, and making architectural decisions iteratively.

---

## Initial Project Prompt

The following prompt was used to generate the first version of the project structure and architecture. Development after that consisted of multiple iterations, debugging sessions, design changes, and manual improvements as issues were discovered.

```text
You are acting as an expert Senior Full-Stack Engineer and Database Architect specializing in Next.js (App Router), TypeScript, and Relational Databases (PostgreSQL via Prisma or Drizzle). 

We are building a highly resilient, enterprise-grade shared expense tracker designed to handle dirty, real-world data data imports. The UI must be completely minimal, clean, and hyper-functional (Tailwind CSS, clean tables, no fancy animations, focused entirely on data integrity and clear UX). Zero tolerance for floating-point errors, unhandled edge cases, or silent data mutations.

Please scaffold a Next.js (App Router) application called "Kakeibo", an enterprise-grade shared expense tracker (similar to Splitwise) designed to handle messy financial histories with absolute precision. 

Use the following stack:
- Next.js (App Router), TypeScript, Tailwind CSS
- Prisma ORM (Version 7.8.0+) with `@prisma/adapter-pg` for PostgreSQL
- NextAuth.js (v5) for passwordless Google OAuth authentication
- pnpm as the package manager

Please implement the following core architectural requirements:

1. DATABASE SCHEMA & INTEGRITY:
- Create models for User, Account, Session (standard NextAuth).
- Create models for Group, GroupMembership, Expense, ExpenseSplit, and MutationKey (for idempotency).
- GroupMembership MUST have `joinedAt` and `leftAt` timestamps to enforce temporal isolation (users can only participate in expenses if they were active in the group on that exact date).
- ALL monetary values must be stored strictly as integers (`amountInCents`) to prevent floating-point precision errors. Do not use Floats or Decimals for money.

2. PRISMA CONFIGURATION:
- Set up a strict Singleton pattern for the Prisma Client in a `prisma.config.ts` file to prevent connection exhaustion during Next.js hot-reloads, explicitly utilizing the native `@prisma/adapter-pg` driver.

3. TWO-PASS CSV INGESTION PIPELINE:
- Users need to upload raw bank CSVs. Do not write parsed CSV data directly to the ledger.
- Create staging models: `ImportBatch`, `ImportRow`, and `ImportAnomaly`.
- Build a parser that reads the CSV and stages the data in memory.
- Create an "Anomaly Detection Engine" that scans the staged rows against strict rules: Missing critical fields, Invalid split math (percentages not equaling 100%), Currency Ambiguity (e.g., USD used instead of INR), Conflicting Duplicates, Zero-value transactions, Settlement Misclassifications, and Temporal Membership violations.
- Build a "Review Phase" UI that displays these staged rows. If an anomaly is an ERROR, block the commit and force the user to edit the data inline. If it's a WARNING, ask for user confirmation. 
- Only write to the actual Expense ledger when the user explicitly clicks "Commit" on clean rows.

4. DYNAMIC BALANCES & ACID TRANSACTIONS:
- Do not store a derived "balance" column on the User table. Balances must be dynamically calculated on the fly from the raw Expense and Settlement records to serve as a Single Source of Truth.
- When creating an expense, logging splits, or settling debts, wrap the entire multi-step database operation in a strict Prisma Interactive Transaction to ensure atomicity. If any step fails, everything must roll back.

5. SERVER ACTIONS & UI:
- Use React Server Actions for all data mutations (e.g., committing the CSV, adding an expense, joining a group) instead of traditional API routes.
- The UI should have a premium, dark-themed aesthetic (purples, deep blacks, whites) using Tailwind CSS. 
- Ensure all data tables have fixed column minimum widths and text wrapping to prevent horizontal overlapping on smaller screens.

Implement strict checking and explicit policy rules for these 12 deliberate corruptions:
1. **Currency Ambiguity:** Detect rows marked as "Trip" or with USD symbols. Apply a hardcoded exchange rate (e.g., 1 USD = 83 INR) instead of a naive 1:1 map.
2. **Time-Bound Membership Violation:** Flag if an expense date is after Meera's exit date or before Sam's entry date.
3. **Duplicate Detection:** Identify records with the exact same timestamp, payer, and description, or identical events with conflicting amounts.
4. **Settlement Misclassification:** Identify entries like "Rohan paid Aisha" that are logged as normal expenses instead of explicit balance settlements.
5. **Negative Amounts:** Determine if the entry represents a refund, a mistake, or an income balance correction.
6. **Inconsistent Number Formats:** Strip out local string formatting anomalies like commas ("2,300"), currency suffixes ("2300/-"), or trailing white spaces.
7. **Missing Critical Fields:** Gracefully handle rows missing an amount, a description, or a payer ID.
8. **Invalid Split Mathematics:** Ensure percentages sum to exactly 100% or that individual exact splits match the total amount.
9. **Unknown Guest Users:** Detect unexpected users in the file (e.g., "Dev") who aren't pre-registered group members.
10. **Zero-Value Transactions:** Flag rows containing 0 amounts.
11. **Future-Dated Records:** Flag timestamps that exceed the current real-world server time.
12. **Malformed CSV Rows:** Handle unclosed quotation marks or unexpected column lengths without crashing the parser.

### Code Delivery Instructions
1. Write clean, modular, strongly-typed TypeScript.
2. Separate the raw parsing logic from the database write actions so that the parsing logic can be easily unit tested.
3. Provide descriptive inline code comments explaining the data mutation state transitions.

```

---

## AI Mistakes & Manual Corrections

AI tools helped speed up development, but they also introduced several implementation and architectural issues that had to be identified and fixed manually. Below are some of the more significant examples.

### 1. Prisma Version & Adapter Configuration Issues

#### What went wrong

The initial Prisma setup generated by the AI mixed configurations from different Prisma versions. It also assumed a more traditional Prisma setup and did not properly configure the newer `@prisma/adapter-pg` approach.

As a result, migrations failed and database connections were not configured correctly.

#### How I found it

The problem showed up immediately when running the first migration. Prisma reported schema and datasource configuration errors, and the project wasn't able to connect to the database correctly.

#### What I changed

I upgraded the project to Prisma `v7.8.0`, configured the PostgreSQL adapter manually, and implemented a singleton Prisma client.

At the time, most generated solutions were still based on older Prisma patterns, so I ended up adapting parts of the configuration from a previous project and adjusting them for the newer adapter-based setup.

---

### 2. Placeholder Users Showing Up As Active Members

#### What went wrong

The import pipeline automatically creates temporary users when it encounters names in imported CSV files.

For example, importing a CSV containing names such as Aisha or Rohan could create placeholder accounts using emails like:

```text
aisha@group.imported.local
```

The dashboard's active member count was including these temporary accounts even though no expenses had been committed yet.

As a result, simply uploading a CSV for review made the group appear to have far more active members than it actually did.

#### How I found it

While testing imports, I noticed the active member count increased immediately after uploading a CSV, even before committing any data to the ledger.

That behaviour didn't make sense because the review stage should not affect group statistics.

#### What I changed

I updated the dashboard member-count calculation to exclude placeholder users created during the staging process.

```ts
// Before
group?.memberships.filter(
  (m) => m.leftAt === null || m.leftAt > new Date()
);
```

```ts
// After
group?.memberships.filter(
  (m) =>
    (m.leftAt === null || m.leftAt > new Date()) &&
    !m.user.email?.includes(".imported.local")
);
```

This keeps imported placeholder users visible where needed, but prevents them from affecting dashboard metrics.

---

### 3. NextAuth OAuthAccountNotLinked Issue

#### What went wrong

The application allows admins to add users before those users have signed in for the first time.

The AI-generated implementation created database user records successfully, but it didn't account for how NextAuth handles OAuth account linking.

When a pre-created user later attempted to sign in with Google, NextAuth found the email address but rejected the login because no OAuth account was linked yet.

#### How I found it

During testing, Google sign-in consistently failed for users that had been added manually through the admin flow.

The login attempt resulted in an `OAuthAccountNotLinked` error.

#### What I changed

I updated the Google provider configuration in `src/lib/auth.config.ts` and enabled:

```ts
allowDangerousEmailAccountLinking: true
```

This allows NextAuth to safely link a Google account to an existing user record when the email addresses match.

After the change, users that were pre-created by an admin could sign in successfully without requiring additional manual account linking steps.
