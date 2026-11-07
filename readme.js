transactions.append(transaction)
return transaction
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
