# AI Usage Disclosure & Pair Programming Log

This project was built using **Antigravity**, an agentic AI coding assistant, following a
pair-programming workflow. The AI was responsible for architecting the models, writing the CSV
import logic, building the React UI, and implementing the settlement mathematics. I (the human
developer) acted as the product manager and QA tester — verifying the financial math, reviewing
edge cases in the data, and steering the AI's architectural decisions.

## Key Prompts

Below are representative prompts that directed the major phases of development.

### 1. Initial project setup and architecture

> "I have to make this whole task as good as possible. I will be using Antigravity for this task.
> Please write a detailed prompt for Antigravity — how it should approach this, using React +
> Tailwind for frontend and Django for backend. The CSV anomalies need to be detected, surfaced,
> and handled according to a documented policy, not silently guessed. Build in small, reviewable
> commits, propose the DB schema and key policy decisions (FX rate, rounding, duplicate handling,
> settlement modeling) before scaffolding, and wait for confirmation."

This prompt established the monorepo structure, the Django + React + PostgreSQL stack, the core
data model (Group, GroupMembership, Expense, ExpenseSplit, Settlement, ImportBatch,
ImportAnomaly), and the incremental commit-based build order followed for the rest of the project.

### 2. Reporting the Dev-exclusion membership bug

> "Major issue found: the importer is auto-excluding Dev from every Goa-trip expense (Goa flights,
> villa booking, beach lunch, scooter rentals, parasailing, both Thalassa dinners) because Dev has
> no GroupMembership row. But Dev is a real person who participated in and partly paid for these
> expenses — he's just not a flatmate, by design. Excluding him changes who owes what for the
> entire trip and is a serious correctness bug... the 'active member on expense date' check should
> only apply to users WHO HAVE a GroupMembership row in this group. For users in
> split_with/paid_by who exist as a User but have NO GroupMembership row at all (like Dev), do NOT
> run the membership-date check — just include them in the split normally, as the CSV specifies."

This prompt led directly to AI_USAGE case #2 below.

### 3. Reporting the share-split weight bug

> "One issue found in the ledger: 'April rent' shows Rohan's 'Owes Share' as -₹16,000.00. April
> rent was a `share` split type with explicit shares 'Aisha 2; Rohan 1; Priya 1' (total amount
> ₹48,000). With total shares = 2+1+1 = 4, each share should be worth ₹12,000, so Rohan (1 share)
> should owe -₹12,000... -₹16,000 = ₹48,000 / 3 — this looks like the total shares were computed
> as 3 instead of 4, possibly because Aisha's '2' was parsed as a single share... Can you check the
> share-split parser for the `share` split type — specifically how it parses 'Aisha 2; Rohan 1;
> Priya 1' and confirm Aisha ends up with 2 shares (₹24,000) and Rohan/Priya each with 1 share
> (₹12,000 each)?"

This prompt, derived from manually hand-verifying Rohan's balance, led directly to AI_USAGE case
#4 below.

### 4. Requesting the structured anomaly-resolution overhaul

> "I resolved all 6 pending anomalies with the text you'd expect, and the 'Resolved' counter went
> to 6. However, checking the Expenses list afterward, none of the resolutions appear to have
> actually changed the data... It looks like clicking 'Resolve' only updates ImportAnomaly.status
> to 'resolved' and stores my text in some notes field, but does NOT actually create/update the
> corresponding Expense and ExpenseSplit rows based on that resolution. Can you walk me through
> what the 'Resolve' action currently does in the backend, and then implement the actual logic so
> that resolving an anomaly creates/modifies the corresponding Expense/ExpenseSplit records
> according to the resolution text/action?"

This prompt led directly to AI_USAGE case #1 below — the freeform-text resolution UI was replaced
with structured dropdowns/buttons wired to the actual creation pipeline.

### 5. Correcting the Thalassa conflicting-duplicate resolution

> "I need to re-resolve the 'Conflicting Duplicate' anomaly for Row 25 (Thalassa dinner). I
> previously resolved it by keeping Aisha's entry (₹2400) and discarding Rohan's (₹2450). On
> reviewing the raw CSV, I found the note is actually on Rohan's row: 'Aisha also logged this I
> think hers is wrong' — meaning the CSV itself indicates Aisha's ₹2400 entry is the incorrect one,
> and Rohan's ₹2450 is authoritative. I need to reverse this resolution: keep Rohan's entry
> (₹2450), discard Aisha's (₹2400)."

This prompt corrected a resolution decision that had been made earlier in the project — verifying
the raw CSV note text caught a case where the *human* (not the AI) had made the wrong call, and
the AI implemented the reversal (including a backend patch so "Keep New" on a conflicting
duplicate now automatically deletes the superseded entry).

## Cases Where the AI Produced Something Wrong

Below are 5 concrete examples of bugs or logical gaps that were caught and resolved during the
pair-programming session.

### 1. Non-functional Anomaly "Resolve" Buttons

Initially, the AI built a "Resolve Anomaly" UI that allowed me to type in freeform text (e.g.,
"Assigned payer to Aisha"). However, after resolving 6 anomalies, I noticed the total expense
count remained at 32 instead of increasing to ~38.

**The Fix:** I pointed out that the backend was only updating the `ImportAnomaly` status to
"resolved" and saving my text note, without actually injecting the repaired data back into the
Expense pipeline. The AI refactored the UI to use structured dropdowns/buttons instead of text
boxes, and wired the backend to re-run the creation pipeline with the structured overrides.

### 2. Dev Excluded Due to Flawed Membership Check

Dev, a guest on the Goa trip, was completely missing from the splits of the Goa expenses despite
being explicitly listed in the CSV.

**The Fix:** I realized the AI's `GroupMembership` filter was too strict. It correctly dropped
stale members (like Meera after her move-out date), but it was mistakenly checking Dev against
the `GroupMembership` table. Since Dev wasn't a formal member of the apartment group, the check
failed and he was dropped. The AI modified the logic to only apply strict join/leave date
filtering to actual registered `GroupMembership` rows, while allowing "guest" users (like Dev) to
participate in specific splits if explicitly named.

### 3. Duplicate Detection Missed the Thalassa Conflict

Row 24 and Row 25 both represented the "Thalassa dinner", but one was logged by Rohan (₹2,450) and
one by Aisha (₹2,400). The AI's duplicate detector failed to flag this as a conflict.

**The Fix:** The AI was using a basic `icontains`/exact-match string similarity. Because the
strings were "Thalassa dinner" and "Dinner at Thalassa", they didn't match. I instructed the AI to
improve the string matching. It implemented a token-sort comparison (normalizing and sorting
words), which successfully grouped the two rows and flagged the conflicting amounts as an anomaly
for manual resolution.

### 4. Ignored Explicit Weights in "Share" Splits

I noticed Rohan was being charged -₹16,000 for "April rent" instead of the expected -₹12,000. The
CSV explicitly defined the shares as `Aisha 2; Rohan 1; Priya 1` (total 4 shares of a ₹48,000
expense).

**The Fix:** I checked the math and realized 48,000 / 3 = 16,000. The AI's importer was treating
the `share` split type identically to the `equal` split type — simply counting the number of
names in the string (3 names) and ignoring the numeric weights. I pointed this out, and the AI
updated the parser to correctly extract and sum the numeric weights (2+1+1=4) and proportionally
distribute the amounts, fixing both the rent and the "Scooter rentals" expense.

### 5. Ambiguous Date Resolution Tie-breaker Bug

The "Parasailing" expense had an ambiguous date (`11-03-2026`). It was surrounded by rows around
March 9-10 (Goa villa booking, scooter rentals, beach lunch) before, and March 12/14 (Parasailing
refund, Airport cab) after. It should have resolved to March 11th. Instead, the UI showed it
resolving to November 3rd.

**The Fix:** The AI had implemented an isolated-row date resolution that defaulted to
`DD-MM-YYYY` instead of fully respecting the chronological bounds constraint (which would have
mathematically forced it to March 11 to fit between Mar 10 and Mar 12). I reported the bug, and
the AI rewrote the date-distance tie-breaking logic to correctly anchor the interpretation to the
surrounding `last_resolved_date` and `next_valid_date`.

## A Note on AI-Driven Documentation Drift

After the initial 6 anomaly resolutions, I asked the AI to update SCOPE.md/DECISIONS.md, which it
did correctly. However, two further bug fixes later in the session (the "Ambiguous Date"
auto-applied anomaly logging, and the Parasailing split_type override from `equal` to `share`)
were implemented in code but not reflected back into the docs until a final review pass. This is
a useful reminder when directing an AI agent: code fixes and documentation updates need to be
requested together, or docs silently drift out of sync with the actual system.
