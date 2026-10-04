from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from uuid import uuid4

app = Flask(__name__)

# Demo database stored in memory.
# This is for learning only; data disappears when the server stops.
users = {}
transactions = []


def create_transaction(tx_type, sender, receiver, amount):
    transaction = {
        "id": str(uuid4()),
        "type": tx_type,
        "sender": sender,
        "receiver": receiver,
        "amount": amount,
    }

    transactions.append(transaction)
    return transaction


@app.route("/")
def home():
    return jsonify({
        "message": "Banking API is running",
        "endpoints": [
            "POST /register",
            "POST /login",
            "POST /deposit",
            "POST /withdraw",
            "POST /transfer",
            "GET /balance/<username>",
            "GET /transactions/<username>"
        ]
    })


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if username in users:
        return jsonify({"error": "User already exists"}), 409

    users[username] = {
        "password": generate_password_hash(password),
        "balance": 0.0
    }

    return jsonify({
        "message": "Account created successfully",
        "username": username,
        "balance": 0.0
    }), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    user = users.get(username)

    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    return jsonify({
        "message": "Login successful",
        "username": username
    })


@app.route("/deposit", methods=["POST"])
def deposit():
    data = request.get_json()

    username = data.get("username")
    amount = data.get("amount")

    if username not in users:
        return jsonify({"error": "User not found"}), 404

    if not isinstance(amount, (int, float)) or amount <= 0:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    users[username]["balance"] += amount

    create_transaction(
        "DEPOSIT",
        username,
        username,
        amount
    )

    return jsonify({
        "message": "Deposit successful",
        "username": username,
        "balance": users[username]["balance"]
    })


@app.route("/withdraw", methods=["POST"])
def withdraw():
    data = request.get_json()

    username = data.get("username")
    amount = data.get("amount")

    if username not in users:
        return jsonify({"error": "User not found"}), 404

    if not isinstance(amount, (int, float)) or amount <= 0:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    if users[username]["balance"] < amount:
        return jsonify({"error": "Insufficient funds"}), 400

    users[username]["balance"] -= amount

    create_transaction(
        "WITHDRAW",
        username,
        username,
        amount
    )

    return jsonify({
        "message": "Withdrawal successful",
        "username": username,
        "balance": users[username]["balance"]
    })


@app.route("/transfer", methods=["POST"])
def transfer():
    data = request.get_json()

    sender = data.get("sender")
    receiver = data.get("receiver")
    amount = data.get("amount")

    if sender not in users:
        return jsonify({"error": "Sender not found"}), 404

    if receiver not in users:
        return jsonify({"error": "Receiver not found"}), 404

    if sender == receiver:
        return jsonify({"error": "Cannot transfer to yourself"}), 400

    if not isinstance(amount, (int, float)) or amount <= 0:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    if users[sender]["balance"] < amount:
        return jsonify({"error": "Insufficient funds"}), 400

    users[sender]["balance"] -= amount
    users[receiver]["balance"] += amount

    transaction = create_transaction(
        "TRANSFER",
        sender,
        receiver,
        amount
    )

    return jsonify({
        "message": "Transfer successful",
        "transaction": transaction,
        "sender_balance": users[sender]["balance"]
    })


@app.route("/balance/<username>", methods=["GET"])
def balance(username):
    if username not in users:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "username": username,
        "balance": users[username]["balance"]
    })


@app.route("/transactions/<username>", methods=["GET"])
def get_transactions(username):
    if username not in users:
        return jsonify({"error": "User not found"}), 404

    user_transactions = [
        transaction
        for transaction in transactions
        if transaction["sender"] == username
        or transaction["receiver"] == username
    ]

    return jsonify(user_transactions)


if __name__ == "__main__":
    app.run(debug=True)

