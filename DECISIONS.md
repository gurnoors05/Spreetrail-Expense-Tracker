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

## 8. Negative Amounts
**Decision:** Negative expenses are processed through the normal split pipeline; the sign is preserved through to `ExpenseSplit.share_amount`. We are not linking refunds back to original expenses via foreign key; they are independent rows.
**Rationale:** This keeps the splitting engine simple and generic. Note: Balance calculations simply sum these signed `share_amounts` directly without extra logic.

## 9. Percentages Not Summing to 100%
**Decision:** Always flag as a pending `ImportAnomaly`. Never auto-normalize.
**Rationale:** We cannot guess user intent. The UI will offer a choice between (a) proportionally rescaling all percentages so they sum to 100% (showing recalculated numbers), or (b) letting the user manually enter corrected percentages.

## 10. Ambiguous Dates
**Decision:** We assume the CSV is ordered chronologically. For ambiguous dates (e.g., `04-05-2026` or missing-year `Mar-14`), we pick the interpretation that keeps the row's date >= the previous row's resolved date and <= the next row's resolved date.
**Rationale:** Example: `Mar-14` between Mar 12 and Mar 15 resolves to Mar 14 of the current year context. `04-05-2026` between Mar 28 and Apr 2 resolves to Apr 5 (`05-04-2026`). If no interpretation satisfies the sequence, it's flagged as an anomaly.
