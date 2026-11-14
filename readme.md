# Personal Expense Tracker

A full-stack expense management web app. Users can register, log in, record income and expenses, set monthly category budgets, import transactions from CSV, scan receipt photos, and view a dashboard with charts and a spending summary.

## Features
- User registration and login (passwords stored as bcrypt hashes)
- Add, edit and delete transactions, with automatic category detection
- Sort transactions by date or amount (merge sort)
- Search transactions by exact amount (binary search)
- Top 5 highest expenses (min-heap)
- Spending summary: total, count, average, category-wise breakdown (hash map)
- Monthly budgets per category, with progress bars and nearing/exceeded alerts
- Bulk import from CSV files
- Receipt scanning from a photo (EasyOCR + regex), with a review form before saving
- Dashboard with income/expense cards and charts

## Tech Stack
- **Backend:** Python, Flask, Flask-MySQLdb, Flask-Bcrypt, Flask-CORS
- **Database:** MySQL
- **Frontend:** HTML, CSS, JavaScript, Chart.js
- **OCR:** EasyOCR (PyTorch)

## Data Structures and Algorithms Used
| Feature | Technique | Complexity |
|---|---|---|
| Sort by date or amount | Merge sort | O(n log n) |
| Search by exact amount | Binary search (on sorted data) | O(log n) |
| Top-K expenses | Min-heap of size k | O(n log k) |
| Spending summary | Hash map (dictionary) accumulator | O(n) |
| Receipt parsing | Regular expressions and heuristics | O(n) |

## Project Structure
```
app.py                  # Flask app, registers blueprints
config.py               # Database settings
data_processing.py      # Auto-categorization, CSV/file processing
algorithms.py           # Merge sort, binary search
analytics.py            # Top-K expenses, spending summary
receipt_scanner.py      # OCR-based receipt reader
models/db.py            # MySQL connection
routes/
  auth_routes.py        # /signup, /login
  expense_routes.py     # Transactions, sort, search, top-K, summary, import, scan
  budget_routes.py      # Budgets and budget checks
index.html, login.html  # Frontend pages
script.js               # Frontend logic (talks to the backend)
style.css, login.css    # Styling
test.http               # API tests (VS Code REST Client)
```

## Database Tables
- `users` (user_id, username, email, password_hash, created_at)
- `transactions` (txn_id, user_id, amount, type, category, description, txn_date, payment_type)
- `budgets` (budget_id, user_id, category, month, year, limit_amount)

`type` is `income` or `expense`. `payment_type` is one of `cash`, `online`, `card`.

## Setup
1. Install Python and MySQL, and create a database with the tables above.
2. Install dependencies:
   ```
   pip install flask flask-mysqldb flask-bcrypt flask-cors easyocr
   ```
3. Set your MySQL host, user, password and database name in `config.py`.
4. Start the backend:
   ```
   python app.py
   ```
   The API runs at `http://127.0.0.1:5000`.
5. Open `login.html` with VS Code Live Server, register a new user, and log in.

Note: the first receipt scan downloads the OCR models and takes a few minutes. Later scans are faster.

## Main API Endpoints
**Auth**
- `POST /signup`, `POST /login`

**Transactions**
- `POST /transactions`
- `GET /transactions/<user_id>`
- `PUT /transactions/<txn_id>`
- `DELETE /transactions/<txn_id>?user_id=<id>`
- `GET /transactions/<user_id>/sort?by=amount|txn_date&order=asc|desc`
- `GET /transactions/<user_id>/search?amount=<value>`
- `GET /transactions/<user_id>/top?k=5`
- `GET /transactions/<user_id>/summary`
- `POST /import-transactions` (CSV upload)
- `POST /scan-receipt` (image upload)

**Budgets**
- `POST /budgets`, `GET /budgets/<user_id>`
- `PUT /budgets/<budget_id>`, `DELETE /budgets/<budget_id>?user_id=<id>`
- `GET /budget-check/<user_id>/<category>/<month>/<year>`
- `GET /spending/<user_id>/<category>/<month>/<year>`

## CSV Import Format
```
date,amount,description,payment_type
2026-11-01,5000.00,Pocket money,online
2026-11-01,-250.00,Zomato dinner order,online
```
Negative amounts are treated as expenses. If no category column is present, categories are detected automatically.

## Team
- **Jyoti:** Backend (Flask routes, MySQL) and frontend-backend integration
- **Sanskriti:** Data processing and algorithms
- **Neelam:** Frontend design
