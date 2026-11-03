from flask import Blueprint, jsonify, request, session
from flask_bcrypt import Bcrypt

from models.db import mysql

auth_bp = Blueprint('auth_bp', __name__)
bcrypt = Bcrypt()


@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json(silent=True) or {}
    username = str(data.get('username', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = data.get('password', '')

    if (
        not username or not email or not isinstance(password, str)
        or len(password) < 8 or len(password.encode('utf-8')) > 72
    ):
        return jsonify({
            'message': 'Enter a username, email, and a password between 8 and 72 bytes.'
        }), 400

    cur = mysql.connection.cursor()
    try:
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        cur.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)',
            (username, email, password_hash)
        )
        mysql.connection.commit()
        user_id = cur.lastrowid
    finally:
        cur.close()

    session.clear()
    session['user_id'] = user_id
    session['username'] = username
    return jsonify({'message': 'Account created successfully.', 'user_id': user_id, 'username': username}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email', '')).strip().lower()
    password = data.get('password', '')
    if not email or not isinstance(password, str) or not password:
        return jsonify({'message': 'Email and password are required.'}), 400

    cur = mysql.connection.cursor()
    try:
        cur.execute('SELECT * FROM users WHERE email = %s', (email,))
        user = cur.fetchone()
    finally:
        cur.close()

    if not user or not bcrypt.check_password_hash(user[3], password):
        return jsonify({'message': 'Invalid email or password.'}), 401

    session.clear()
    session['user_id'] = int(user[0])
    session['username'] = user[1]
    return jsonify({
        'message': 'Login successful.',
        'user_id': int(user[0]),
        'username': user[1]
    }), 200


@auth_bp.route('/auth/me', methods=['GET'])
def current_user():
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify({'message': 'Please sign in.'}), 401
    return jsonify({'user_id': int(user_id), 'username': session.get('username', '')}), 200


@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Signed out successfully.'}), 200
