from flask import Blueprint, request, jsonify
from flask_bcrypt import Bcrypt
from models.db import mysql

auth_bp = Blueprint('auth_bp', __name__)
bcrypt = Bcrypt()

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data['username']
    email = data['email']
    password = data['password']

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    cur = mysql.connection.cursor()
    cur.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)",
        (username, email, hashed_password)
    )
    mysql.connection.commit()
    cur.close()

    return jsonify({"message": "User registered successfully"}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data['email']
    password = data['password']

    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close()

    if user and bcrypt.check_password_hash(user[3], password):
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"message": "Invalid credentials"}), 401