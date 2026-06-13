---
name: currency-math
description: Use this skill whenever calculating expenses, splitting bills, displaying balances, or updating the database ledger.
---

# Currency Math & Precision Protocol

You MUST never use standard JavaScript floating-point arithmetic for balances or splits. 

## Rules
1. **Database Storage:** Always store monetary values in the database as integers representing the smallest currency unit (e.g., Cents/Paise). $10.50 must be stored as `1050`.
2. **Splitting Inexact Amounts:** When dividing an expense unequally or when an odd cent remains (e.g., splitting $10.00 among 3 people), the remainder must be programmatically allocated to the creator of the expense or the first user.
3. **Calculation Example:**
   - Total: 1000 cents ($10.00)
   - Share per person: Math.floor(1000 / 3) = 333 cents
   - Remainder: 1000 - (333 * 3) = 1 cent
   - Person 1 pays 334, Person 2 pays 333, Person 3 pays 333.