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

    cur = mysql.connection.cursor()
    cur.execute(
        "INSERT INTO transactions (user_id, amount, type, category, description, txn_date) VALUES (%s, %s, %s, %s, %s, %s)",
        (user_id, amount, txn_type, category, description, txn_date)
    )
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "Transaction added successfully"}), 201


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
            "txn_date": str(row[6])
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