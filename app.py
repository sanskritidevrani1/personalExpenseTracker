import os

from flask import Flask, abort, redirect, send_from_directory, session, url_for
from flask_bcrypt import Bcrypt
import config
from models.db import mysql
from routes.auth_routes import auth_bp
from routes.expense_routes import expense_bp
from routes.budget_routes import budget_bp

app = Flask(__name__)
app.config['SECRET_KEY'] = config.SECRET_KEY
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') == 'production'
app.config['MYSQL_HOST'] = config.MYSQL_HOST
app.config['MYSQL_USER'] = config.MYSQL_USER
app.config['MYSQL_PASSWORD'] = config.MYSQL_PASSWORD
app.config['MYSQL_DB'] = config.MYSQL_DB

mysql.init_app(app)
bcrypt = Bcrypt(app)

app.register_blueprint(auth_bp)
app.register_blueprint(expense_bp)
app.register_blueprint(budget_bp)

@app.route('/')
def home():
    if session.get('user_id') is None:
        return redirect(url_for('login_page'))
    return send_from_directory(app.root_path, 'index.html')


@app.route('/login')
def login_page():
    return send_from_directory(app.root_path, 'login.html')


@app.route('/<path:filename>')
def project_file(filename):
    if filename not in {'style.css', 'script.js', 'login.css', 'api.js'}:
        abort(404)
    return send_from_directory(app.root_path, filename)

if __name__ == '__main__':
    app.run()