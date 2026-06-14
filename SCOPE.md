# Kakeibo Scope & Architecture Report

This document covers how the Kakeibo import pipeline works, the kinds of issues it looks for when processing raw CSV data, how those issues are handled, and how the database is structured to keep balances accurate and imports safe.

---

## 1. The Anomaly Detection Engine

One of the first things I realized while building the import system was that CSV files are messy.

Different banks export data differently, users make mistakes while entering expenses, dates come in unexpected formats, split calculations don't always add up correctly, and sometimes the same expense appears multiple times. If imported data is written directly into the ledger without validation, it only takes a few bad rows to make balances unreliable.

To avoid that, I built the import flow as a two-step process using a custom Anomaly Detection Engine.

Instead of committing expenses directly to the ledger, every uploaded CSV is first stored in a staging area using the `ImportBatch` and `ImportRow` tables. Once the data is staged, each row is validated against a set of logical and mathematical rules before the user is allowed to commit it.

Whenever a problem is detected, the system creates an anomaly and surfaces it during the review phase.

* **`[WARNING]`** – The row looks suspicious, but it may still be valid. The user can review it and decide whether to keep it or ignore it.
* **`[ERROR]`** – The row contains invalid or incomplete data. The issue must be fixed before the row can be committed to the ledger.

This approach gives users a chance to review imported data before it affects balances while still allowing the system to handle the kind of messy real-world data that usually shows up in CSV exports.

---

## 2. The Anomaly Log: The 11 Rules We Validate Against

Every imported row is validated against a set of rules that check for common data quality and consistency issues. These checks were added based on actual problems I ran into while testing imports and thinking through edge cases that could affect balances.

### 1. Missing Critical Fields

**The Problem:** A row is missing important information such as the payer's name, the transaction date, or the currency.

**How We Handle It:** `[ERROR]`

Without this information, the expense cannot be processed correctly. The user must provide the missing values during the review phase before the row can be committed.

---

### 2. Invalid Split Math

**The Problem:** The split information does not match the total expense amount.

Examples include percentage splits that add up to more than 100%, or fixed split amounts that don't equal the total bill.

**How We Handle It:** `[ERROR]`

The expense is blocked until the split calculations are corrected. Since balances depend entirely on these values being accurate, the system refuses to commit rows with invalid math.

---

### 3. Currency Ambiguity

**The Problem:** A row is imported in a currency different from the group's base currency.

For example, the ledger operates in INR while an imported expense is recorded in USD.

**How We Handle It:** `[WARNING]`

Rather than maintaining multiple currencies throughout the ledger, imported values are normalized into INR. Before that happens, the user is warned and can review the conversion before continuing.

---

### 4. Conflicting Duplicates

**The Problem:** Two rows appear to represent the same event but contain conflicting information, such as different amounts or different payers.

**How We Handle It:** `[ERROR]`

This usually indicates inconsistent data or an accidental duplicate entry. The system flags the conflict and requires the user to verify which row is correct.

---

### 5. Exact Duplicates

**The Problem:** Two rows have the exact same date, payer, description, and amount.

**How We Handle It:** `[WARNING]`

This often happens when data is exported multiple times or accidentally duplicated. The user can review the duplicate and decide whether it should be imported.

---

### 6. Zero-Value Transactions

**The Problem:** An expense is imported with an amount of `₹0.00`.

**How We Handle It:** `[WARNING]`

A zero-value expense has no effect on balances, but it may still be useful for record keeping. The user can choose whether to keep it or remove it.

---

### 7. Settlement Misclassifications

**The Problem:** A transaction that looks like a repayment is imported as a normal expense.

For example, a description such as "Rohan paid Aisha back" represents a settlement rather than a shared expense.

**How We Handle It:** `[WARNING]`

The system looks for common settlement patterns in transaction descriptions and warns the user when a row appears to be a debt repayment rather than a bill that should be split across the group.

---

### 8. Negative Amounts

**The Problem:** A row contains a negative amount.

This could represent a refund, a correction, or simply a data entry mistake.

**How We Handle It:** `[WARNING]`

The row is flagged and shown to the user for confirmation before being committed.

---

### 9. Invalid Dates

**The Problem:** The date cannot be parsed correctly.

Examples include malformed dates or unsupported formats such as `"Mar-14"`.

**How We Handle It:** `[ERROR]`

Several validations depend on having a valid timestamp, including membership checks and chronological ordering. The date must be corrected before the row can be imported.

---

### 10. Temporal Membership Violations

**The Problem:** A user appears in a split even though they were not an active member of the group on the date the expense occurred.

This could happen because they joined later or had already left the group.

**How We Handle It:** `[ERROR]`

The system validates membership against the expense date and blocks the row until the split is assigned only to users who were active members at that point in time.

---

### 11. Future-Dated Records

**The Problem:** An expense claims to have occurred in the future.

**How We Handle It:** `[WARNING]`

Future-dated transactions are flagged for review. While there may be legitimate cases, they are often the result of incorrect dates or timezone-related issues.

---

## 3. The Database Schema

To support the import flow and ledger system, the database is organized into three logical layers.

### Layer 1: Identity & Authentication

This layer uses the standard NextAuth models.

* **`User`** – Stores user information.
* **`Account`** – Stores OAuth provider details.
* **`Session`** – Stores active login sessions.

This allows users to sign in using Google OAuth without having to manage passwords directly.

---

### Layer 2: Import Staging

Imported data is intentionally isolated from the financial ledger until validation is complete.

* **`ImportBatch`** – Represents a single CSV upload.
* **`ImportRow`** – Represents an individual row from the imported file and stores both raw and normalized data.
* **`ImportAnomaly`** – Stores validation issues detected during processing, including severity, type, and descriptive messages.

Keeping imported data separate from the ledger means users can upload incomplete, inconsistent, or heavily corrupted CSV files without affecting balances. Nothing reaches the actual ledger until the review phase is completed and the user explicitly commits the import.

---

### Layer 3: The Financial Ledger

This layer contains the actual source of truth used to calculate balances.

* **`Group`** – Represents an expense-sharing group.
* **`GroupMembership`** – Tracks who belongs to a group and includes `joinedAt` and `leftAt` timestamps.

The membership timestamps are important because they allow the system to determine whether a user was actually part of the group when a particular expense occurred.

* **`Expense`** – Represents the main expense record. Monetary values are stored as `amountInCents` using integers to avoid floating-point precision issues.
* **`ExpenseSplit`** – Stores how much of an expense each participant owes.
* **`MutationKey`** – Provides idempotency protection and prevents duplicate writes when the same operation is submitted multiple times.

For example, if a user accidentally clicks the "Commit" button twice, the system can guarantee that the import is only processed once.

---

## Why This Architecture?

The main goal behind this design is simple: imported data should never be trusted immediately, and balances should always be derived from validated records.

CSV imports go through a staging layer before they reach the ledger, every row is validated against a defined set of rules, membership is verified against the expense date, and all monetary values are stored as integers to avoid precision issues.

The result is a system where bad imports can be caught early, balances remain consistent, and every expense can be traced back to a validated source.
