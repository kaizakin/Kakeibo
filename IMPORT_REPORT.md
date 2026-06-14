# Import Report: CSV Ingestion Audit

**Date of Import:** June 15, 2026  
**Status:** Staged - Awaiting Manual Review  
**Total Rows Processed:** 42
**Flagged Rows (Requires Action):** 14  
**Clean rows:** 35
**Errors:** 7

---

## Executive Summary

As part of the two-pass ingestion pipeline, Kakeibo's Anomaly Detection engine scanned the uploaded CSV file before committing any data to the database ledger. The engine audits the data against strict financial and logical rules. 

Below is the exact output report of every anomaly detected within the batch, the severity of the issue, and the context (including split breakdowns) to assist in the interactive Review Phase.

---

## Detected Anomalies Log

### Row #13
* **Anomaly:** `[ERROR] MISSING CRITICAL FIELD`
* **Message:** Missing payer (paid_by field is empty).

### Row #14
* **Anomaly:** `[WARNING] SETTLEMENT MISCLASSIFICATION`
* **Message:** "Rohan paid Aisha back" looks like a settlement/payment, not a shared expense. Should this be recorded as a debt settlement?
* **Details:** `{"description": "Rohan paid Aisha back"}`
* **Split Breakdown:** Aisha (₹5,000.00)

### Row #15
* **Anomaly:** `[ERROR] INVALID SPLIT MATH`
* **Message:** Percentage splits sum to 110%, not 100%.

### Row #20
* **Anomaly:** `[WARNING] CURRENCY AMBIGUITY`
* **Message:** Row uses USD. Will convert using hardcoded rate (1 USD = 83 INR) for balance calculations.

### Row #21
* **Anomaly:** `[WARNING] CURRENCY AMBIGUITY`
* **Message:** Row uses USD. Will convert using hardcoded rate (1 USD = 83 INR) for balance calculations.
* **Split Breakdown:** 
  - Aisha (₹21.00)
  - Rohan [Paid] (₹21.00)
  - Priya (₹21.00)
  - Dev (₹21.00)

### Row #23
* **Anomaly:** `[WARNING] CURRENCY AMBIGUITY`
* **Message:** Row uses USD. Will convert using hardcoded rate (1 USD = 83 INR) for balance calculations.
* **Split Breakdown:** 
  - Aisha (₹30.00)
  - Rohan (₹30.00)
  - Priya (₹30.00)
  - Dev [Paid] (₹30.00)
  - Dev's friend Kabir (₹30.00)

### Row #24
* **Anomaly:** `[ERROR] CONFLICTING DUPLICATE`
* **Message:** Possible conflict with row 25: similar event on same date but different amounts.

### Row #25
* **Anomaly:** `[ERROR] CONFLICTING DUPLICATE`
* **Message:** Possible conflict with row 24: similar event on same date but different amounts.

### Row #26
* **Anomaly 1:** `[WARNING] CURRENCY AMBIGUITY`
* **Message 1:** Row uses USD. Will convert using hardcoded rate (1 USD = 83 INR) for balance calculations.
* **Anomaly 2:** `[WARNING] NEGATIVE AMOUNT`
* **Message 2:** Negative amount (-3000 cents). Could be a refund, correction, or data entry error.
* **Split Breakdown:** 
  - Aisha (₹7.50)
  - Rohan (₹7.50)
  - Priya (₹7.50)
  - Dev [Paid] (₹7.50)

### Row #27
* **Anomaly:** `[ERROR] INVALID DATE`
* **Message:** Cannot parse date: "Mar-14".

### Row #28
* **Anomaly:** `[ERROR] MISSING CRITICAL FIELD`
* **Message:** Missing currency — cannot determine if INR or USD.

### Row #31
* **Anomaly:** `[WARNING] ZERO VALUE TRANSACTION`
* **Message:** Zero-amount transaction: "Dinner order Swiggy". This has no financial effect.
* **Split Breakdown:** 
  - Aisha (₹0.00)
  - Rohan (₹0.00)
  - Priya [Paid] (₹0.00)
  - Meera (₹0.00)

### Row #32
* **Anomaly:** `[ERROR] INVALID SPLIT MATH`
* **Message:** Percentage splits sum to 110%, not 100%.

### Row #38
* **Anomaly:** `[WARNING] SETTLEMENT MISCLASSIFICATION`
* **Message:** "Sam deposit share" looks like a settlement/payment, not a shared expense. Should this be recorded as a debt settlement?
* **Split Breakdown:** Aisha (₹15,000.00)

---

## Resolution Workflow

Because Kakeibo uses a strict **Two-Pass Ingestion Pipeline**, absolutely no data from this CSV has touched the database yet. 

To resolve this report:
1. Navigate to the **Review Phase** dashboard.
2. Edit the data for the `[ERROR]` rows (e.g., fixing the 110% split math on Row 15, fixing the date on Row 27). Editing triggers a live re-validation.
3. Click **Accept** or **Reject** on the `[WARNING]` rows based on whether the action (like USD conversion) is intended.
4. Click **Commit Records**. All approved, error-free rows will then be saved to the ledger within a secure database transaction.
