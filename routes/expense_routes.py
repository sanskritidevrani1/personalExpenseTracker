from datetime import date
import math
import os
import tempfile

from flask import Blueprint, jsonify, request, session

from models.db import mysql

expense_bp = Blueprint('expense_bp', __name__)


def get_transaction_payload(data):
    amount = data.get('amount')
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return None, 'Amount must be a positive number.'

    txn_type = data.get('type')
    category = str(data.get('category', '')).strip()
    description = str(data.get('description', '')).strip()
    txn_date = data.get('txn_date')
    payment_type = str(data.get('payment_type', 'Online / UPI')).strip()

    if not math.isfinite(amount) or amount <= 0:
        return None, 'Amount must be greater than zero.'
    if txn_type not in ('expense', 'income'):
        return None, 'Type must be expense or income.'
    if not category or not description or not payment_type:
        return None, 'Category, title, and payment method are required.'
    try:
        parsed_date = date.fromisoformat(txn_date)
    except (TypeError, ValueError):
        return None, 'Date must use YYYY-MM-DD format.'

    return (amount, txn_type, category, description, parsed_date, payment_type), None


@expense_bp.route('/transactions', methods=['POST'])
def add_transaction():
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401

    data = request.get_json(silent=True) or {}
    payload, error = get_transaction_payload(data)
    if error:
        return jsonify({'message': error}), 400

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            'INSERT INTO transactions '
            '(user_id, amount, type, category, description, txn_date, payment_type) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s)',
            (user_id, *payload)
        )
        mysql.connection.commit()
        txn_id = cur.lastrowid
    finally:
        cur.close()

    return jsonify({'message': 'Transaction added successfully.', 'txn_id': txn_id}), 201


@expense_bp.route('/transactions/<int:user_id>', methods=['GET'])
def get_transactions(user_id):
    authenticated_user_id = session.get('user_id')
    if authenticated_user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401
    if authenticated_user_id != user_id:
        return jsonify({'message': 'You cannot view another user’s transactions.'}), 403

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            'SELECT txn_id, user_id, amount, type, category, description, txn_date, payment_type '
            'FROM transactions WHERE user_id = %s ORDER BY txn_date DESC, txn_id DESC',
            (authenticated_user_id,)
        )
        rows = cur.fetchall()
    finally:
        cur.close()

    return jsonify([{
        'txn_id': row[0],
        'user_id': row[1],
        'amount': float(row[2]),
        'type': row[3],
        'category': row[4],
        'description': row[5],
        'txn_date': row[6].isoformat() if hasattr(row[6], 'isoformat') else str(row[6]),
        'payment_type': row[7]
    } for row in rows]), 200


@expense_bp.route('/transactions/<int:txn_id>', methods=['PUT'])
def update_transaction(txn_id):
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401

    data = request.get_json(silent=True) or {}
    payload, error = get_transaction_payload(data)
    if error:
        return jsonify({'message': error}), 400

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            'UPDATE transactions SET amount = %s, type = %s, category = %s, '
            'description = %s, txn_date = %s, payment_type = %s '
            'WHERE txn_id = %s AND user_id = %s',
            (*payload, txn_id, user_id)
        )
        mysql.connection.commit()
        updated = cur.rowcount
    finally:
        cur.close()

    if not updated:
        return jsonify({'message': 'Transaction not found.'}), 404
    return jsonify({'message': 'Transaction updated successfully.'}), 200


@expense_bp.route('/transactions/<int:txn_id>', methods=['DELETE'])
def delete_transaction(txn_id):
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            'DELETE FROM transactions WHERE txn_id = %s AND user_id = %s',
            (txn_id, user_id)
        )
        mysql.connection.commit()
        deleted = cur.rowcount
    finally:
        cur.close()

    if not deleted:
        return jsonify({'message': 'Transaction not found.'}), 404
    return jsonify({'message': 'Transaction deleted successfully.'}), 200


@expense_bp.route('/import-transactions', methods=['POST'])
def import_transactions():
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401

    file = request.files.get('file')
    if not file or not file.filename:
        return jsonify({'message': 'Choose a CSV or Excel file to import.'}), 400

    suffix = os.path.splitext(file.filename)[1].lower()
    if suffix not in ('.csv', '.xlsx'):
        return jsonify({'message': 'Only CSV and XLSX files are supported.'}), 400

    temp_path = None
    try:
        from data_processing import process_transaction_file

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
        file.save(temp_path)
        transactions = process_transaction_file(temp_path, int(user_id))
        rows = [
            (item['user_id'], item['amount'], item['type'], item['category'],
             item['description'], item['txn_date'], item['payment_type'])
            for item in transactions
        ]
        cur = mysql.connection.cursor()
        try:
            if rows:
                cur.executemany(
                    'INSERT INTO transactions '
                    '(user_id, amount, type, category, description, txn_date, payment_type) '
                    'VALUES (%s, %s, %s, %s, %s, %s, %s)',
                    rows
                )
                mysql.connection.commit()
        finally:
            cur.close()
    except (ValueError, KeyError) as error:
        return jsonify({'message': 'Could not read the transaction file.', 'error': str(error)}), 400
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

    return jsonify({'message': 'Transactions imported successfully.', 'imported': len(rows)}), 201
