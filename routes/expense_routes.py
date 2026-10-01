from flask import Blueprint, request, jsonify
from models.db import mysql

expense_bp = Blueprint('expense_bp', __name__)

# Add a new transaction (income or expense)
@expense_bp.route('/transactions', methods=['POST'])
def add_transaction():
    data = request.get_json()
    user_id = data['user_id']
    amount = data['amount']
    txn_type = data['type']
    category = data.get('category', '')
    description = data.get('description', '')
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

# Get all transactions for a user
@expense_bp.route('/transactions/<int:user_id>', methods=['GET'])
def get_transactions(user_id):
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

    return jsonify(transactions), 200


# Update a transaction
@expense_bp.route('/transactions/<int:txn_id>', methods=['PUT'])
def update_transaction(txn_id):
    data = request.get_json()
    amount = data['amount']
    category = data.get('category', '')
    description = data.get('description', '')

    cur = mysql.connection.cursor()
    cur.execute(
        "UPDATE transactions SET amount = %s, category = %s, description = %s WHERE txn_id = %s",
        (amount, category, description, txn_id)
    )
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "Transaction updated successfully"}), 200


# Delete a transaction
@expense_bp.route('/transactions/<int:txn_id>', methods=['DELETE'])
def delete_transaction(txn_id):
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM transactions WHERE txn_id = %s", (txn_id,))
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "Transaction deleted successfully"}), 200