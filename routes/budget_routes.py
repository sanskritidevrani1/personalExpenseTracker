import math

from flask import Blueprint, jsonify, request, session

from models.db import mysql

budget_bp = Blueprint('budget_bp', __name__)
TOTAL_BUDGET_CATEGORY = '__TOTAL__'


def parse_budget_data(data):
    category = str(data.get('category', '')).strip()
    try:
        month = int(data.get('month'))
        year = int(data.get('year'))
        limit_amount = float(data.get('limit_amount'))
    except (TypeError, ValueError):
        return None, 'Month, year, and a positive budget amount are required.'

    if not category or not 1 <= month <= 12 or not 2000 <= year <= 9999:
        return None, 'Enter a category and valid month and year.'
    if not math.isfinite(limit_amount) or limit_amount <= 0:
        return None, 'Enter a category, valid month and year, and a budget greater than zero.'
    return (category, month, year, limit_amount), None


@budget_bp.route('/budgets', methods=['POST'])
def add_budget():
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401

    data = request.get_json(silent=True) or {}
    payload, error = parse_budget_data(data)
    if error:
        return jsonify({'message': error}), 400
    category, month, year, limit_amount = payload

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            'SELECT budget_id FROM budgets '
            'WHERE user_id = %s AND category = %s AND month = %s AND year = %s',
            (user_id, category, month, year)
        )
        existing = cur.fetchone()
        if existing:
            budget_id = int(existing[0])
            cur.execute(
                'UPDATE budgets SET limit_amount = %s WHERE budget_id = %s AND user_id = %s',
                (limit_amount, budget_id, user_id)
            )
        else:
            cur.execute(
                'INSERT INTO budgets (user_id, category, month, year, limit_amount) '
                'VALUES (%s, %s, %s, %s, %s)',
                (user_id, category, month, year, limit_amount)
            )
            budget_id = cur.lastrowid
        mysql.connection.commit()
    finally:
        cur.close()

    return jsonify({
        'message': 'Budget saved successfully.',
        'budget_id': int(budget_id)
    }), 200


@budget_bp.route('/budgets/<int:user_id>', methods=['GET'])
def get_budgets(user_id):
    authenticated_user_id = session.get('user_id')
    if authenticated_user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401
    if authenticated_user_id != user_id:
        return jsonify({'message': 'You cannot view another user’s budgets.'}), 403

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            'SELECT budget_id, user_id, category, month, year, limit_amount '
            'FROM budgets WHERE user_id = %s ORDER BY year DESC, month DESC, category',
            (authenticated_user_id,)
        )
        rows = cur.fetchall()
    finally:
        cur.close()

    return jsonify([{
        'budget_id': row[0],
        'user_id': row[1],
        'category': row[2],
        'month': int(row[3]),
        'year': int(row[4]),
        'limit_amount': float(row[5])
    } for row in rows]), 200


@budget_bp.route('/budgets/<int:budget_id>', methods=['PUT'])
def update_budget(budget_id):
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401

    data = request.get_json(silent=True) or {}
    try:
        limit_amount = float(data.get('limit_amount'))
    except (TypeError, ValueError):
        return jsonify({'message': 'Budget amount must be a positive number.'}), 400
    if not math.isfinite(limit_amount) or limit_amount <= 0:
        return jsonify({'message': 'Budget amount must be greater than zero.'}), 400

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            'UPDATE budgets SET limit_amount = %s WHERE budget_id = %s AND user_id = %s',
            (limit_amount, budget_id, user_id)
        )
        mysql.connection.commit()
        updated = cur.rowcount
    finally:
        cur.close()

    if not updated:
        return jsonify({'message': 'Budget not found.'}), 404
    return jsonify({'message': 'Budget updated successfully.'}), 200


@budget_bp.route('/budgets/<int:budget_id>', methods=['DELETE'])
def delete_budget(budget_id):
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            'DELETE FROM budgets WHERE budget_id = %s AND user_id = %s',
            (budget_id, user_id)
        )
        mysql.connection.commit()
        deleted = cur.rowcount
    finally:
        cur.close()

    if not deleted:
        return jsonify({'message': 'Budget not found.'}), 404
    return jsonify({'message': 'Budget deleted successfully.'}), 200


@budget_bp.route('/spending/<int:user_id>/<category>/<int:month>/<int:year>', methods=['GET'])
def get_total_spent(user_id, category, month, year):
    if session.get('user_id') is None:
        return jsonify({'message': 'Please sign in.'}), 401
    if session['user_id'] != user_id:
        return jsonify({'message': 'You cannot view another user’s spending.'}), 403

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            "SELECT SUM(amount) FROM transactions WHERE user_id = %s AND category = %s "
            "AND type = 'expense' AND MONTH(txn_date) = %s AND YEAR(txn_date) = %s",
            (user_id, category, month, year)
        )
        result = cur.fetchone()
    finally:
        cur.close()

    return jsonify({
        'category': category,
        'total_spent': float(result[0]) if result and result[0] else 0.0
    }), 200


@budget_bp.route('/budget-check/<int:user_id>/<category>/<int:month>/<int:year>', methods=['GET'])
def check_budget_status(user_id, category, month, year):
    if session.get('user_id') is None:
        return jsonify({'message': 'Please sign in.'}), 401
    if session['user_id'] != user_id:
        return jsonify({'message': 'You cannot view another user’s budget.'}), 403

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            'SELECT limit_amount FROM budgets WHERE user_id = %s AND category = %s '
            'AND month = %s AND year = %s',
            (user_id, category, month, year)
        )
        budget_row = cur.fetchone()
        cur.execute(
            "SELECT SUM(amount) FROM transactions WHERE user_id = %s AND category = %s "
            "AND type = 'expense' AND MONTH(txn_date) = %s AND YEAR(txn_date) = %s",
            (user_id, category, month, year)
        )
        spent_row = cur.fetchone()
    finally:
        cur.close()

    if not budget_row:
        return jsonify({'message': 'No budget set for this category.'}), 404

    limit_amount = float(budget_row[0])
    total_spent = float(spent_row[0]) if spent_row and spent_row[0] else 0.0
    status = 'exceeded' if total_spent >= limit_amount else (
        'nearing_limit' if total_spent >= 0.8 * limit_amount else 'within_budget'
    )
    return jsonify({
        'category': category,
        'limit_amount': limit_amount,
        'total_spent': total_spent,
        'status': status
    }), 200
