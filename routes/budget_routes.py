from flask import Blueprint, request, jsonify
from models.db import mysql

budget_bp = Blueprint('budget_bp', __name__)

# Set a new budget
@budget_bp.route('/budgets', methods=['POST'])
def add_budget():
    data = request.get_json()
    user_id = data['user_id']
    category = data['category']
    month = data['month']
    year = data['year']
    limit_amount = data['limit_amount']

    cur = mysql.connection.cursor()
    cur.execute(
        "INSERT INTO budgets (user_id, category, month, year, limit_amount) VALUES (%s, %s, %s, %s, %s)",
        (user_id, category, month, year, limit_amount)
    )
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "Budget set successfully"}), 201


# Get all budgets for a user
@budget_bp.route('/budgets/<int:user_id>', methods=['GET'])
def get_budgets(user_id):
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM budgets WHERE user_id = %s", (user_id,))
    rows = cur.fetchall()
    cur.close()

    budgets = []
    for row in rows:
        budgets.append({
            "budget_id": row[0],
            "user_id": row[1],
            "category": row[2],
            "month": row[3],
            "year": row[4],
            "limit_amount": float(row[5])
        })

    return jsonify(budgets), 200


# Update a budget
@budget_bp.route('/budgets/<int:budget_id>', methods=['PUT'])
def update_budget(budget_id):
    data = request.get_json()
    limit_amount = data['limit_amount']

    cur = mysql.connection.cursor()
    cur.execute(
        "UPDATE budgets SET limit_amount = %s WHERE budget_id = %s",
        (limit_amount, budget_id)
    )
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "Budget updated successfully"}), 200


# Delete a budget
@budget_bp.route('/budgets/<int:budget_id>', methods=['DELETE'])
def delete_budget(budget_id):
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM budgets WHERE budget_id = %s", (budget_id,))
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "Budget deleted successfully"}), 200
    
    
    # Get total amount spent in a category for a given month/year
@budget_bp.route('/spending/<int:user_id>/<category>/<int:month>/<int:year>', methods=['GET'])
def get_total_spent(user_id, category, month, year):
    cur = mysql.connection.cursor()
    cur.execute(
        "SELECT SUM(amount) FROM transactions WHERE user_id = %s AND category = %s AND type = 'expense' AND MONTH(txn_date) = %s AND YEAR(txn_date) = %s",
        (user_id, category, month, year)
    )
    result = cur.fetchone()
    cur.close()

    total_spent = float(result[0]) if result[0] else 0.0

    return jsonify({"category": category, "total_spent": total_spent}), 200