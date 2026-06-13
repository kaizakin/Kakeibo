# AGENTS.md

## Project Overview

This project is an expense-sharing application similar to Splitwise.

Users can:

* Create groups
* Add expenses
* Split expenses among members
* Track balances
* View who owes whom
* Settle debts

Primary goal:

* Maintain accurate financial calculations
* Preserve data consistency
* Prevent incorrect balance updates

Accuracy is more important than feature velocity.

---

## Tech Stack

* Next.js (App Router)
* TypeScript
* Tailwind CSS
* Prisma
* PostgreSQL
* pnpm

---

## Core Principles

### Financial Data Is Critical

When modifying expense, balance, settlement, or transaction logic:

* Never make assumptions
* Trace all balance updates
* Verify calculations
* Consider edge cases

Incorrect balances are considered critical bugs.

### Single Source of Truth

Avoid storing derived values when they can be calculated.

Prefer:

* transactions
* expenses
* settlements

as source data.

Compute balances from source records whenever practical.

### Data Integrity First

When performing multi-step financial operations:

* Use database transactions
* Ensure atomicity
* Prevent partial updates

---

## Development Workflow

Before making code changes:

1. Understand the feature request
2. Search the codebase
3. Identify affected modules
4. Create a plan
5. Explain the plan
6. Only then modify code

Always use create-plan for non-trivial tasks.

---

## Code Style

### TypeScript

* Use strict typing
* Avoid any
* Prefer inferred types where obvious
* Create reusable types when shared

Bad:

```ts
const user: any = data;
```

Good:

```ts
const user = data;
```

or

```ts
type User = {
  id: string;
  name: string;
};
```

### Functions

Prefer small focused functions.

Avoid functions longer than ~50 lines unless justified.

### Naming

Use descriptive names.

Good:

```ts
calculateGroupBalances()
createExpense()
settleDebt()
```

Avoid:

```ts
calc()
handle()
data()
```

---

## Next.js Guidelines

### Server First

Prefer:

* Server Components
* Server Actions

Use Client Components only when necessary for:

* Interactivity
* Browser APIs
* Local UI state

### Data Fetching

Fetch data on the server whenever possible.

Avoid unnecessary client-side requests.

---

## Database Rules

### Prisma

Prefer Prisma queries over raw SQL.

Use raw SQL only when:

* Performance demands it
* Prisma cannot express the query

### Migrations

Never modify migration history.

Create new migrations.

---

## Expense Logic Rules

Before changing expense calculations:

Verify:

* Equal splits
* Percentage splits
* Custom amount splits
* Expense edits
* Expense deletion
* Settlement handling

Ensure balances remain correct after every operation.

---

## UI Guidelines

### Tailwind

Use Tailwind utilities.

Avoid custom CSS unless necessary.

### Accessibility

All interactive elements must:

* Have labels
* Be keyboard accessible
* Have proper focus states

---

## Testing

Before finishing work:

* Verify TypeScript passes
* Verify build succeeds
* Verify affected features work
* Check balance calculations manually

For financial logic:

Add or update tests whenever possible.

---

## Performance

Avoid:

* N+1 queries
* Unnecessary re-renders
* Duplicate API requests

Prefer:

* Server rendering
* Efficient database queries
* Memoization only when justified

---

## Git

Commit messages should be:

feat: add group settlement flow
fix: correct balance calculation bug
refactor: simplify expense service

Avoid vague commits such as:

update code
fix stuff

---

## If Unsure

Do not guess.

Investigate the codebase, explain findings, propose a plan, and ask for clarification when requirements are ambiguous.