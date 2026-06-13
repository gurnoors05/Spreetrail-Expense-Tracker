# Scope Document

This project is a Shared Expenses App built to handle complex group expense splitting, including an intelligent CSV importer for processing historical expense records with various anomalies.

## 1. Database Schema

### Entity-Relationship Description

*   **User**: The central actor. A person who belongs to groups, pays for expenses, and owes shares. We extend standard Django auth.
*   **Group**: A collection of users sharing expenses over time.
*   **GroupMembership**: Maps Users to Groups, tracking exactly when they joined (`joined_date`) and left (`left_date`). This is crucial for calculating if a user should be included in a split on a specific date.
*   **Expense**: A record of a payment made by a user for the group. Fields include `amount`, `currency`, `date`, `paid_by`, `split_type`, and `is_settlement`.
*   **ExpenseSplit**: Represents each member's owed portion of an Expense. An Expense has many ExpenseSplits.
*   **Settlement**: Explicitly models a payment from one User to another User to clear debt. Completely separate from Expenses to maintain clear semantic meaning.
*   **ImportBatch**: Tracks a CSV upload event.
*   **ImportAnomaly**: Tracks rows from the CSV that could not be automatically processed due to missing data, ambiguity, or conflicts. Belongs to an ImportBatch and requires human resolution.

## 2. CSV Anomalies Addressed

The importer detects and handles the following anomalies present in the provided CSV:

1.  **Inconsistent Date Formats**: e.g., `Mar-14` (no year) and `04-05-2026` (ambiguous). Rows are expected to be in non-decreasing chronological order. The importer picks the interpretation (inferring the year if missing) that keeps the row's date >= the previous row's resolved date and <= the next row's resolved date. If no interpretation fits, it flags as a pending anomaly.
2.  **Number Formatting**: Stripping thousands separators (e.g., `"1,200"`).
3.  **Excessive Decimal Precision**: e.g., `899.995`. Handled via a precise Banker's rounding policy.
4.  **Inconsistent Name Casing/Spacing**: e.g., `priya`, `Priya S`, `rohan `. Normalized to canonical member records.
5.  **Missing Payer**: Left as `None` and flagged as a pending anomaly for manual resolution.
6.  **Settlement Logged as Expense**: Empty split type, split with one person. Detected and converted to a `Settlement` record.
7.  **Duplicate Expenses**: Exact duplicates (same date, amount, payer, desc) are discarded. Conflicting duplicates (same date/event, different amounts/payers) are flagged for human review.
8.  **Foreign Currency (USD)**: Converted to INR using a fixed exchange rate (e.g., 1 USD = 83.50 INR) and documented.
9.  **Negative Amount (Refund)**: Negative expenses are processed through the normal split pipeline; the sign is preserved through to `ExpenseSplit.share_amount`.
10. **Non-member in Split**: e.g., `Kabir`. Flagged as an anomaly for manual resolution (add as dummy user or reassign share).
11. **Missing Currency**: Defaulted to `INR`.
12. **Zero-amount Expense**: Treated as informational / skipped from balance calculation.
13. **Split Type / Details Mismatch**: e.g., `equal` but with explicit share details. Flagged for review.
14. **Percentages Not Summing to 100%**: Always flagged as a pending `ImportAnomaly`. The resolution UI offers to either proportionally rescale to 100% or allow manual correction.
15. **Stale/Incorrect Membership**: E.g. Meera in split after moving out. Corrected automatically by validating against `GroupMembership` active dates.
16. **Mid-period Joins/Leaves**: Proper exclusion and inclusion based on `GroupMembership.joined_date` and `left_date`.
17. **Share Splits**: Proportional parsing of explicit shares (e.g., `Aisha 1; Rohan 2`).

## 3. Final Resolution of Specific Anomalies

During the import of `Expenses Export.csv`, the following 6 anomalies were resolved interactively via the UI:

- **Row 13 (House cleaning supplies)**: Missing payer. Resolved by manually assigning the payer to **Aisha**.
- **Row 15 (Pizza Friday)**: Percentage mismatch (did not sum to 100%). Resolved via equalization (**₹360 each** for Aisha, Rohan, Priya, Sam).
- **Row 23 (Parasailing)**: Kabir was listed in the split but is not a registered member. Resolved by folding Kabir's share directly into **Dev's** share (treating Dev as paying for his guest).
- **Row 25 (Thalassa trip)**: Conflicting duplicate entries between Aisha (₹2,400) and Rohan (₹2,450). Resolved by keeping Aisha's entry and discarding Rohan's.
- **Row 32 (Weekend brunch)**: Percentage mismatch. Resolved via equalization (**₹550 each** for Aisha, Rohan, Priya, Meera).
- **Row 42 (Furniture for common room)**: Mismatch between split type (`equal`) and split details (which explicitly had individual amounts). Resolved by forcing an equal split (**₹3,000 each** across Aisha, Rohan, Priya, Sam).
