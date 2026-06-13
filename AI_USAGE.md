# AI Usage Disclosure & Pair Programming Log

This project was built using **Antigravity**, an agentic AI coding assistant, following a pair-programming workflow. The AI was responsible for architecting the models, writing the CSV import logic, building the React UI, and implementing the settlement mathematics. I (the human developer) acted as the product manager and QA tester—verifying the financial math, reviewing edge cases in the data, and steering the AI's architectural decisions.

Below are 5 key examples of bugs or logical gaps that were caught and resolved during our pair programming session:

## 1. Non-functional Anomaly "Resolve" Buttons
Initially, the AI built a "Resolve Anomaly" UI that allowed me to type in freeform text (e.g., "Assigned payer to Aisha"). However, after resolving 6 anomalies, I noticed the total expense count remained at 32 instead of increasing to ~38. 
**The Fix:** I pointed out that the backend was only updating the `ImportAnomaly` status to "resolved" and saving my text note, without actually injecting the repaired data back into the Expense pipeline. The AI refactored the UI to use structured dropdowns/buttons instead of text boxes, and wired the backend to re-run the creation pipeline with the structured overrides.

## 2. Dev Excluded Due to Flawed Membership Check
Dev, a guest on the Goa trip, was completely missing from the splits of the Goa expenses despite being explicitly listed in the CSV.
**The Fix:** I realized the AI's `GroupMembership` filter was too strict. It correctly dropped stale members (like Meera after her move-out date), but it was mistakenly checking Dev against the `GroupMembership` table. Since Dev wasn't a formal member of the apartment group, the check failed and he was dropped. The AI modified the logic to only apply strict join/leave date filtering to actual registered `GroupMembership` rows, while allowing "guest" users (like Dev) to participate in specific splits if explicitly named.

## 3. Duplicate Detection Missed the Thalassa Conflict
Row 24 and Row 25 both represented the "Thalassa dinner", but one was logged by Rohan (₹2,450) and one by Aisha (₹2,400). The AI's duplicate detector failed to flag this as a conflict.
**The Fix:** The AI was using a basic `icontains` or exact-match string similarity. Because the strings were "Thalassa dinner" and "Dinner at Thalassa", they didn't match. I instructed the AI to improve the string matching. It implemented a token-sort comparison (normalizing and sorting words), which successfully grouped the two rows and flagged the conflicting amounts as an anomaly for manual resolution.

## 4. Ignored Explicit Weights in "Share" Splits
I noticed Rohan was being charged -₹16,000 for "April rent" instead of the expected -₹12,000. The CSV explicitly defined the shares as `Aisha 2; Rohan 1; Priya 1` (total 4 shares of a ₹48,000 expense).
**The Fix:** I checked the math and realized 48,000 / 3 = 16,000. The AI's importer was treating the `share` split type identically to the `equal` split type—simply counting the number of names in the string (3 names) and ignoring the numeric weights. I pointed this out, and the AI updated the parser to correctly extract and sum the numeric weights (2+1+1=4) and proportionally distribute the amounts, fixing both the rent and the "Scooter rentals" expense.

## 5. Ambiguous Date Resolution Tie-breaker Bug
The "Parasailing" expense had an ambiguous date (`11-03-2026`). It was surrounded by a March 5th expense and a March 15th expense. It should have resolved to March 11th. Instead, the UI showed it resolving to November 3rd.
**The Fix:** The AI had implemented an isolated-row date resolution that defaulted to `DD-MM-YYYY` instead of fully respecting the chronological bounds constraint (which would have mathematically forced it to March 11 to fit between Mar 5 and Mar 15). I reported the bug, and the AI rewrote the date-distance tie-breaking logic to correctly anchor the interpretation to the surrounding `last_resolved_date` and `next_valid_date`.
