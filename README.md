# SpreeTrail Expense Tracker

SpreeTrail is a sophisticated full-stack web application designed to help groups of friends track, split, and settle shared expenses. It features an intelligent CSV import engine capable of ingesting historical, messy expense data and automatically detecting, flagging, and allowing interactive resolution of over 15 types of real-world data anomalies.

This project was built entirely with the assistance of **Antigravity**, an agentic AI coding assistant.

## Features
- **Intelligent CSV Import Pipeline**: Robust handling of dirty data, ambiguous dates, name normalization, implicit settlements, and duplicate detection.
- **Interactive Anomaly Resolution**: A dedicated UI to review flagged CSV rows (e.g. percentages not summing to 100%, missing payers) and resolve them mathematically without guessing user intent.
- **Strict Financial Engine**: Banker's rounding ensures parity to the exact penny. 
- **Time-based Memberships**: Expense splits properly respect user join and leave dates (e.g. `joined_date`, `left_date`).
- **Granular Ledger Drill-Down**: Deep transparency into exact balances. "No magic numbers."
- **Debt Simplification**: Greedy algorithm minimizes the number of transactions required to settle up the group.

## Tech Stack
- **Backend**: Django, Django REST Framework, SQLite
- **Frontend**: React, Vite, React Router, Vanilla CSS
- **AI Assistant**: Antigravity

## Setup Instructions & Local Run Steps

### 1. Backend (Django)
```bash
cd backend
python -m venv venv
# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
The backend API will run on `http://localhost:8000/`.

*Note: Pre-create test users (`aisha`, `rohan`, `priya`, `meera`, `sam`, `dev`) and a group via the Django admin (`http://localhost:8000/admin`, create a superuser via `python manage.py createsuperuser`) before running your first import.*

### 2. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
The frontend UI will run on `http://localhost:5173/`.

## Deployment
- **Live URL**: *(Placeholder for deployed URL)*
