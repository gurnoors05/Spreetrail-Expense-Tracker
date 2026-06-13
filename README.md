# SpreeTail Expense Tracker

SpreeTail is a full-stack web application for groups to track, split, and settle shared expenses.
It features an intelligent CSV import engine capable of ingesting historical, messy expense data
and automatically detecting, flagging, and allowing interactive resolution of 16+ real-world data
anomalies.

This project was built with [Antigravity](https://example.com), an agentic AI coding assistant,
as the primary development collaborator. See `AI_USAGE.md` for the AI usage disclosure, including
specific cases where the AI's output was incorrect and how it was caught and fixed.

## Live Deployment

- **Frontend (Vercel):** [https://YOUR-FRONTEND-URL.vercel.app](https://spreetrail-expense-tracker.vercel.app/)
- **Backend API (Render):** https://spreetrail-expense-tracker-1.onrender.com
- **Django Admin:** https://spreetrail-expense-tracker-1.onrender.com/admin/

### Test Accounts (Deployed App)

All accounts (including admin) use the password: `1234`

| Username | Password | Role / Notes |
|----------|----------|--------------|
| aisha    | 1234     | Flatmate since Feb — currently owed the most |
| rohan    | 1234     | Flatmate since Feb |
| priya    | 1234     | Flatmate since Feb |
| meera    | 1234     | Flatmate Feb–Mar (left 2026-03-31) — excluded from post-March expenses |
| sam      | 1234     | Joined mid-April (2026-04-08) |
| dev      | 1234     | Trip guest — registered user, NOT a group member (appears in Goa-trip expense splits only) |
| admin    | 1234     | Django admin superuser (`/admin/` access only) |

The "Flatmates" group is pre-populated with the full CSV import already processed (Batch #1 on
the deployed instance), including all 6 anomaly resolutions. Log in as any user above to see their
individual balance and ledger drill-down — try `rohan` or `priya` to see a member who owes money,
and `aisha` to see the largest creditor.

## Features

- **Intelligent CSV Import Pipeline:** handles inconsistent date formats, thousands separators,
  excessive decimal precision, inconsistent name casing, missing payers, settlements mis-logged as
  expenses, duplicate and conflicting duplicate detection, foreign currency conversion, negative
  (refund) amounts, non-member splits, missing currency, zero-amount rows, split-detail mismatches,
  percentage mismatches, and stale/inactive membership.
- **Interactive Anomaly Resolution:** a dedicated UI reviews flagged rows and lets the user resolve
  them via structured controls (dropdowns, equalize/force-equal buttons) — no freeform guessing.
- **Persistent Import History:** every import batch and its full anomaly report is stored and
  reviewable after the fact.
- **Strict Financial Engine:** all money uses `Decimal`, Banker's rounding (`ROUND_HALF_EVEN`), and
  remainder-penny distribution so splits always sum exactly to the total.
- **Time-based Memberships:** `GroupMembership.joined_date` / `left_date` ensure a member is only
  included in splits for expenses dated while they were active. Users who are NOT group members at
  all (e.g. `dev`) are included in splits as named in the data, without a membership-date check.
- **Granular Ledger Drill-Down:** every balance is traceable to the exact expenses and settlements
  that produced it — "no magic numbers."
- **Debt Simplification:** a greedy algorithm proposes the minimum number of transactions to settle
  all debts, alongside the raw pairwise balances.

## Tech Stack

- **Backend:** Django, Django REST Framework, Simple JWT
  - Database: SQLite (local development) / PostgreSQL (production, via `dj-database-url` +
    `DATABASE_URL` env var)
- **Frontend:** React, Vite, React Router, Tailwind CSS
- **AI Assistant:** Antigravity

## Documentation

- `SCOPE.md` — full anomaly log (all 17 detected anomalies + how each was handled) and database
  schema
- `DECISIONS.md` — decision log: each significant design/policy decision, alternatives considered,
  and rationale
- `AI_USAGE.md` — AI usage disclosure, including 5+ concrete cases where the AI's first attempt was
  wrong and how it was corrected

## Setup Instructions (Local)

### 1. Backend (Django)

```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # create your own local admin account
python manage.py runserver
```

The backend API runs on `http://localhost:8000/`.

By default (no `DATABASE_URL` set), this uses a local SQLite database (`db.sqlite3`). To use
PostgreSQL locally or in production, set `DATABASE_URL` to a Postgres connection string.

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173/` and expects the backend at `http://localhost:8000/`
by default (configurable via `VITE_API_URL`).

### 3. Initial Data Setup (Local)

Before importing the CSV, register the 6 test accounts via the frontend's register page:
`aisha`, `rohan`, `priya`, `meera`, `sam`, `dev` (any password).

Then:
1. Log in as `aisha`, create a group ("Flatmates")
2. Add `aisha`, `rohan`, `priya`, `meera` as members with `joined_date = 2026-02-01`
3. Add `sam` with `joined_date = 2026-04-08`
4. Set `meera`'s `left_date = 2026-03-31`
5. Do **not** add `dev` as a group member — only register the user account
6. Go to "Import CSV", upload `expenses_export.csv`, and resolve the 6 pending anomalies in the
   anomaly report (see `SCOPE.md` for the resolution applied to each)

## Environment Variables (Production)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Render provides this) |
| `SECRET_KEY` | Django secret key |
| `DEBUG` | Set to `False` in production |
| `ALLOWED_HOSTS` | Comma-separated allowed hostnames |
| `VITE_API_URL` (frontend) | Backend API base URL |
