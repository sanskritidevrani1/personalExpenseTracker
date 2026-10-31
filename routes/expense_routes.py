from flask import Blueprint, request, jsonify
from models.db import mysql
import os
import tempfile
from data_processing import auto_categorize_transaction, process_transaction_file
from algorithms import merge_sort_transactions, binary_search_by_amount
from analytics import get_top_k_expenses



expense_bp = Blueprint('expense_bp', __name__)


@expense_bp.route('/transactions', methods=['POST'])
def add_transaction():
    data = request.get_json()
    user_id = data['user_id']
    amount = data['amount']
    txn_type = data['type']
    description = data.get('description', '')
    category = data.get('category', '')
    if not category or category == 'Auto':
            print("DEBUG:", repr(description), "->", repr(category))
            category = auto_categorize_transaction(description)
    txn_date = data['txn_date']
    payment_type = data.get('payment_type', 'online')

    cur = mysql.connection.cursor()
    cur.execute(
        "INSERT INTO transactions (user_id, amount, type, category, description, txn_date, payment_type) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (user_id, amount, txn_type, category, description, txn_date, payment_type)
    )
    mysql.connection.commit()

    budget_alert = None
    if txn_type == 'expense':
        from datetime import datetime
        month = datetime.strptime(txn_date, '%Y-%m-%d').month
        year = datetime.strptime(txn_date, '%Y-%m-%d').year

        cur.execute(
            "SELECT limit_amount FROM budgets WHERE user_id = %s AND category = %s AND month = %s AND year = %s",
            (user_id, category, month, year)
        )
        budget_row = cur.fetchone()

        if budget_row:
            cur.execute(
                "SELECT SUM(amount) FROM transactions WHERE user_id = %s AND category = %s AND type = 'expense' AND MONTH(txn_date) = %s AND YEAR(txn_date) = %s",
                (user_id, category, month, year)
            )
            spent_row = cur.fetchone()
            limit_amount = float(budget_row[0])
            total_spent = float(spent_row[0]) if spent_row[0] else 0.0

            status = "within_budget"
            if total_spent >= limit_amount:
                status = "exceeded"
            elif total_spent >= 0.8 * limit_amount:
                status = "nearing_limit"

            budget_alert = {
                "limit_amount": limit_amount,
                "total_spent": total_spent,
                "status": status
            }

    cur.close()

    response = {"message": "Transaction added successfully"}
    if budget_alert:
        response["budget_alert"] = budget_alert

    return jsonify(response), 201



def fetch_user_transactions(user_id):
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM transactions WHERE user_id = %s", (user_id,))
    rows = cur.fetchall()
    cur.close()

    transactions = []
    for row in rows:
        transactions.append({
            "txn_id": row[0],
            "user_id": row[1],
            "amount": float(row[2]),
            "type": row[3],
            "category": row[4],
            "description": row[5],
            "txn_date": str(row[6]),
            "payment_type": row[8]
        })
    return transactions


@expense_bp.route('/transactions/<int:user_id>', methods=['GET'])
def get_transactions(user_id):
    return jsonify(fetch_user_transactions(user_id)), 200


@expense_bp.route('/transactions/<int:txn_id>', methods=['PUT'])
def update_transaction(txn_id):
    data = request.get_json()
    user_id = data['user_id']
    amount = data['amount']
    category = data.get('category', '')
    description = data.get('description', '')

    cur = mysql.connection.cursor()
    cur.execute(
        "UPDATE transactions SET amount = %s, category = %s, description = %s WHERE txn_id = %s AND user_id = %s",
        (amount, category, description, txn_id, user_id)
    )
    mysql.connection.commit()
    rows_affected = cur.rowcount
    cur.close()

    if rows_affected == 0:
        return jsonify({"message": "Transaction not found or does not belong to this user"}), 404

    return jsonify({"message": "Transaction updated successfully"}), 200


@expense_bp.route('/transactions/<int:txn_id>', methods=['DELETE'])
def delete_transaction(txn_id):
    user_id = request.args.get('user_id')

    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM transactions WHERE txn_id = %s AND user_id = %s", (txn_id, user_id))
    mysql.connection.commit()
    rows_affected = cur.rowcount
    cur.close()

    if rows_affected == 0:
        return jsonify({"message": "Transaction not found or does not belong to this user"}), 404

    return jsonify({"message": "Transaction deleted successfully"}), 200


@expense_bp.route('/import-transactions', methods=['POST'])
def import_transactions():
    # 1. Check if request came via form-data OR json
    if request.is_json:
        data = request.get_json()
        user_id = data.get('user_id')
        file_path = data.get('file_path')
        if not user_id or not file_path:
            return jsonify({"message": "user_id and file_path are required"}), 400
        
        try:
            transactions = process_transaction_file(file_path, int(user_id))
        except Exception as e:
            return jsonify({"message": "Could not read file", "error": str(e)}), 400

    else:
        # Standard File Upload
        user_id = request.form.get('user_id')
        file = request.files.get('file')
        if not user_id or not file:
            return jsonify({"message": "user_id and file are required"}), 400

        suffix = os.path.splitext(file.filename)[1].lower()
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.close()
        file.save(tmp.name)

        try:
            transactions = process_transaction_file(tmp.name, int(user_id))
        except Exception as e:
            return jsonify({"message": "Could not read file", "error": str(e)}), 400
        finally:
            if os.path.exists(tmp.name):
                os.remove(tmp.name)

    rows = [
        (t['user_id'], t['amount'], t['type'], t['category'],
         t['description'], t['txn_date'], t['payment_type'])
        for t in transactions
    ]

    cur = mysql.connection.cursor()
    cur.executemany(
        "INSERT INTO transactions (user_id, amount, type, category, description, txn_date, payment_type) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        rows
    )
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "Transactions imported successfully", "imported": len(transactions)}), 201

@expense_bp.route('/transactions/<int:user_id>/sort', methods=['GET'])
def sort_transactions(user_id):
    sort_by = request.args.get('by', 'txn_date')     # txn_date या amount
    order = request.args.get('order', 'asc')         # asc या desc

    if sort_by not in ('txn_date', 'amount'):
        return jsonify({"message": "by must be 'txn_date' or 'amount'"}), 400

    txns = fetch_user_transactions(user_id)
    result = merge_sort_transactions(txns, sort_by, order == 'desc')
    return jsonify(result), 200


@expense_bp.route('/transactions/<int:user_id>/search', methods=['GET'])
def search_by_amount(user_id):
    amount = request.args.get('amount', type=float)
    if amount is None:
        return jsonify({"message": "amount query parameter is required"}), 400

    txns = fetch_user_transactions(user_id)
    sorted_txns = merge_sort_transactions(txns, 'amount', False)   # binary search से पहले ascending sort ज़रूरी
    matches = binary_search_by_amount(sorted_txns, amount)
    return jsonify(matches), 200

@expense_bp.route('/transactions/<int:user_id>/top', methods=['GET'])
def top_expenses(user_id):
    k = request.args.get('k', default=5, type=int)
    if k <= 0:
        return jsonify({"message": "k must be a positive number"}), 400

    txns = fetch_user_transactions(user_id)
    return jsonify(get_top_k_expenses(txns, k)), 200