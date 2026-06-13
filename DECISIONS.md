# Architectural and Policy Decisions

## 1. Settlements vs. Expenses
**Decision:** We are using a separate `Settlement` model instead of overloading the `Expense` model with an `is_settlement` flag.
**Rationale:** A settlement is a strict 1-to-1 payment (payer to payee) to clear debt, conceptually distinct from a shared expense that requires split calculation logic. Separating them prevents irrelevant fields (`split_type`, `original_currency`) from cluttering the settlement logic, and makes the CSV anomaly conversion (Anomaly 6: converting a mislogged expense into a settlement) structurally explicit.

## 2. FX Rate Policy
**Decision:** All money is stored in INR using `DecimalField`. USD expenses are converted at a fixed rate of `1 USD = 83.50 INR`.
**Rationale:** Since the trip data is historical, using a live API introduces unnecessary external dependencies and volatility. The exact `original_amount`, `original_currency`, and `exchange_rate_used` are stored on the `Expense` record for transparency.

## 3. Rounding Policy
**Decision:** We use Python's `decimal.Decimal` with `ROUND_HALF_EVEN` (Banker's Rounding) to 2 decimal places. To handle rounding losses/gains (e.g., `100 / 3 = 33.33` x 3 = `99.99`), we distribute the remainder pennies sequentially to members in the split until the sum exactly matches the total amount.
**Rationale:** Financial applications require exact parity. Standard floating-point math is unacceptable due to precision errors. The remainder distribution ensures the ledger always balances perfectly.

## 4. Kabir (Non-Member) in Split
**Decision:** When a non-member is found in a split, it is flagged as a pending anomaly. It cannot be auto-applied. Meera (the user) must either assign the share to an existing member (e.g., Dev, who brought him) or create a dummy user for Kabir.
**Rationale:** Silently excluding him alters the financial reality of the expense. The system must maintain strict referential integrity with the `User` and `GroupMembership` models.

## 5. Duplicate Handling
**Decision:**
*   **Exact Duplicates**: If an expense matches exactly on Date, Amount, Payer, and a normalized string-distance of Description, the duplicate is discarded automatically.
*   **Conflicting Duplicates**: (e.g., Thalassa dinner logged by Aisha and Rohan with different amounts). These are flagged as `ImportAnomaly` requiring manual resolution to choose which one is authoritative.
**Rationale:** The system shouldn't blindly guess on conflicting reports of the same event, as one person might be wrong about the amount.

## 6. Debt Simplification Algorithm
**Decision:** We use a greedy algorithm matching the largest debtor with the largest creditor.
**Rationale:** This minimizes the number of raw transactions required to settle up the group ("Who pays whom"), which is standard for apps like Splitwise. We also preserve the raw pairwise balances so users can see the exact itemized breakdown if they prefer.

## 7. Sam's Deposit Treatment
**Decision:** Sam paying Aisha a ₹15,000 deposit is treated as a `Settlement` from Sam to Aisha, not an expense.
**Rationale:** This was a direct transfer to balance out rent obligations, functionally identical to paying back a debt. It does not need to be split among other members.
**Implementation Note (Import Heuristic Only):** To handle legacy CSV data, the importer uses a keyword heuristic: if `split_type == 'settlement'` OR the description contains "settlement" or "deposit" (case-insensitive), the row is converted to a Settlement. This logic is strictly scoped to the `CSVImporter` pipeline. Regular API creations (e.g., via the manual UI forms) do not use this fuzzy matching, preventing false positives on legitimate future shared expenses like "Security deposit for damage".

## 8. Negative Amounts
**Decision:** Negative expenses are processed through the normal split pipeline; the sign is preserved through to `ExpenseSplit.share_amount`. We are not linking refunds back to original expenses via foreign key; they are independent rows.
**Rationale:** This keeps the splitting engine simple and generic. Note: Balance calculations simply sum these signed `share_amounts` directly without extra logic.

## 9. Percentages Not Summing to 100%
**Decision:** Always flag as a pending `ImportAnomaly`. Never auto-normalize.
**Rationale:** We cannot guess user intent. The UI offers a choice between proportionally rescaling all percentages, manually entering new percentages, or forcing an equal split.
**Implementation Note:** For ambiguous percentage splits (e.g. "Pizza Friday" and "Weekend brunch"), they were resolved via the simpler "Force Equal" fallback rather than complex proportional rescaling, since equalization is mathematically simple and highly defensible for generic shared meals.

## 10. Ambiguous Dates
**Decision:** We assume the CSV is ordered chronologically. For ambiguous dates (e.g., `04-05-2026` or missing-year `Mar-14`), we pick the interpretation that keeps the row's date >= the previous row's resolved date and <= the next row's resolved date.
**Rationale:** Example: `Mar-14` between Mar 12 and Mar 15 resolves to Mar 14 of 2026. `04-05-2026` between Mar 28 and Apr 2 resolves to Apr 5 (`05-04-2026`). If no interpretation satisfies the sequence, it's flagged as an anomaly.

## 11. Member Name Matching in CSV Importer
**Decision:** The importer matches CSV `paid_by` / `split_with` values to `User.username` using two passes:
1. **Exact case-insensitive match** — `'Aisha'` → `username='aisha'`, `'rohan '` → `username='rohan'`
2. **First-token fallback** — `'Priya S'` → first token `'priya'` → `username='priya'`

If neither pass finds a user, it flags a `Non-member in Split` anomaly (e.g., `Kabir` who is not in the system).
**Consequence:** Users **must be pre-created** with the correct lowercase first-name username before importing the CSV. No fuzzy or phonetic matching is performed.
**Test account usernames to use:** `aisha`, `rohan`, `priya`, `meera`, `sam`, `dev`

## 12. Final Anomaly Resolutions (Expenses Export.csv)
**Decision:** The following exact resolutions were manually applied to the 6 detected pending anomalies during the import of `Expenses Export.csv`:
1. **Row 13 (House cleaning supplies)**: Missing payer. Resolved by manually assigning the payer to **Aisha**.
2. **Row 15 (Pizza Friday)**: Percentage mismatch. Resolved via equalize (**₹360 each**).
3. **Row 23 (Parasailing)**: Kabir listed but is a non-member. Resolved by folding his share directly into **Dev's** share.
4. **Row 25 (Thalassa trip)**: Conflicting duplicate entries. Resolved by keeping Aisha's **₹2,400** entry and discarding Rohan's **₹2,450** entry.
5. **Row 32 (Weekend brunch)**: Percentage mismatch. Resolved via equalize (**₹550 each**).
6. **Row 42 (Furniture for common room)**: Split type (`equal`) and split details (explicit amounts) mismatch. Resolved by forcing an equal split (**₹3,000 each**).
