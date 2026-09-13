from flask import Flask
from flask_bcrypt import Bcrypt
import config
from models.db import mysql
from routes.auth_routes import auth_bp
from routes.expense_routes import expense_bp

app = Flask(__name__)
app.config['MYSQL_HOST'] = config.MYSQL_HOST
app.config['MYSQL_USER'] = config.MYSQL_USER
app.config['MYSQL_PASSWORD'] = config.MYSQL_PASSWORD
app.config['MYSQL_DB'] = config.MYSQL_DB

mysql.init_app(app)
bcrypt = Bcrypt(app)

app.register_blueprint(auth_bp)
app.register_blueprint(expense_bp)

@app.route('/')
def home():
    return "Backend running!"

if __name__ == '__main__':
    app.run(debug=True)