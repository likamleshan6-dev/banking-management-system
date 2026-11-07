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
from flask import Flask, request, redirect, url_for, render_template_string, flash
import sqlite3
from pathlib import Path
from datetime import datetime
from decimal import Decimal, InvalidOperation
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

DB = Path(__file__).with_name("novabank.db")


# =========================
# DATABASE
# =========================

def connect():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize():
    with connect() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            account_number TEXT UNIQUE NOT NULL,
            account_type TEXT NOT NULL,
            balance_cents INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            kind TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            description TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(account_id) REFERENCES accounts(id)
        );

        CREATE TABLE IF NOT EXISTS salaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL,
            amount_cents INTEGER NOT NULL,
            pay_period TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id),
            FOREIGN KEY(account_id) REFERENCES accounts(id)
        );
        """)


def timestamp():
    return datetime.now().strftime("%d %b %Y, %H:%M")


def money(cents):
    return f"KSh {cents / 100:,.2f}"


def convert_money(value):
    try:
        amount = Decimal(value).quantize(Decimal("0.01"))
        if amount <= 0:
            raise ValueError
        return int(amount * 100)
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Enter a valid amount greater than zero.")


# =========================
# PROFESSIONAL DESIGN
# =========================

LAYOUT = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>{{ title }} | NovaBank</title>

<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
rel="stylesheet">

<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
rel="stylesheet">

<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap"
rel="stylesheet">

<style>

:root {
    --navy: #101b36;
    --blue: #4263eb;
    --background: #f5f7fc;
    --text: #18233d;
    --muted: #8490a7;
}

body {
    background: var(--background);
    font-family: 'DM Sans', sans-serif;
    color: var(--text);
}

.sidebar {
    width: 250px;
    min-height: 100vh;
    position: fixed;
    background: linear-gradient(160deg, #101b36, #1a315e);
    color: white;
    padding: 28px 18px;
}

.brand {
    font-family: Manrope;
    font-size: 26px;
    font-weight: 800;
    padding: 0 10px 35px;
}

.brand span {
    color: #7da0ff;
}

.nav-link {
    color: #b7c3dc;
    padding: 13px;
    border-radius: 12px;
    margin: 4px 0;
    font-size: 14px;
    font-weight: 600;
}

.nav-link:hover,
.nav-link.active {
    background: #293d6b;
    color: white;
}

.nav-link i {
    margin-right: 12px;
}

.main {
    margin-left: 250px;
    padding: 35px;
}

h1, h2, h3, h4 {
    font-family: Manrope;
    font-weight: 800;
}

.page-title {
    font-size: 26px;
}

.card {
    border: 1px solid #edf0f6;
    border-radius: 18px;
    box-shadow: 0 8px 28px rgba(28,44,83,.04);
}

.stat-card {
    padding: 22px;
}

.stat-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: #edf1ff;
    color: var(--blue);
    font-size: 19px;
    margin-bottom: 15px;
}

.metric {
    font-family: Manrope;
    font-size: 25px;
    font-weight: 800;
}

.muted {
    color: var(--muted);
    font-size: 12px;
}

.hero {
    background: linear-gradient(110deg, #17284e, #4263eb);
    color: white;
    padding: 32px;
}

.hero p {
    color: #c3d0ef;
}

.btn-primary {
    background: var(--blue);
    border-color: var(--blue);
    border-radius: 10px;
    padding: 10px 17px;
    font-weight: 700;
}

.form-control, .form-select {
    border-radius: 10px;
    padding: 11px;
    font-size: 13px;
}

.form-label {
    font-size: 12px;
    font-weight: 700;
}

.table th {
    color: var(--muted);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.table td, .table th {
    padding: 14px 10px;
    vertical-align: middle;
}

.badge-blue {
    background: #edf1ff;
    color: #4263eb;
}

.badge-green {
    background: #e8f8f1;
    color: #14865f;
}

@media(max-width: 750px) {
    .sidebar {
        width: 100%;
        min-height: auto;
        position: relative;
    }

    .main {
        margin-left: 0;
        padding: 20px;
    }

    .sidebar .nav {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }
}

</style>
</head>

<body>

<div class="sidebar">

    <div class="brand">
        Nova<span>Bank.</span>
    </div>

    <div class="small text-uppercase opacity-50 mb-3">
        Main workspace
    </div>

    <nav class="nav flex-column">

        <a class="nav-link {{ 'active' if active=='dashboard' else '' }}"
           href="/">
           <i class="bi bi-grid-1x2-fill"></i> Overview
        </a>

        <a class="nav-link {{ 'active' if active=='customers' else '' }}"
           href="/customers">
           <i class="bi bi-people"></i> Customers
        </a>

        <a class="nav-link {{ 'active' if active=='accounts' else '' }}"
           href="/accounts">
           <i class="bi bi-wallet2"></i> Accounts
        </a>

        <a class="nav-link {{ 'active' if active=='salaries' else '' }}"
           href="/salaries">
           <i class="bi bi-cash-stack"></i> Payroll
        </a>

    </nav>

    <div class="small opacity-50 mt-5">
        DEMO BANKING SYSTEM
    </div>

</div>


<div class="main">

    <div class="d-flex justify-content-between align-items-center mb-4">

        <div>
            <div class="muted">NOVABANK / MANAGEMENT</div>
            <h2 class="page-title">{{ title }}</h2>
        </div>

        <span class="badge rounded-pill text-bg-light p-2">
            ● Demo environment
        </span>

    </div>

    {% with messages = get_flashed_messages() %}
        {% for message in messages %}
            <div class="alert alert-info">
                {{ message }}
            </div>
        {% endfor %}
    {% endwith %}

    {{ content|safe }}

    <div class="text-center muted mt-5">
        © NovaBank {{ year }} | Banking Management Demo
    </div>

</div>

</body>
</html>
"""


def show_page(title, active, content, **kwargs):
    return render_template_string(
        LAYOUT,
        title=title,
        active=active,
        content=content,
        year=datetime.now().year,
        **kwargs
    )


# =========================
# DASHBOARD
# =========================

@app.route("/")
def dashboard():

    with connect() as con:

        customers = con.execute(
            "SELECT COUNT(*) FROM customers"
        ).fetchone()[0]

        accounts = con.execute(
            "SELECT COUNT(*) FROM accounts"
        ).fetchone()[0]

        balance = con.execute(
            "SELECT COALESCE(SUM(balance_cents),0) FROM accounts"
        ).fetchone()[0]

        salaries = con.execute(
            """SELECT COALESCE(SUM(amount_cents),0)
               FROM salaries WHERE status='PAID'"""
        ).fetchone()[0]

        recent = con.execute("""
            SELECT transactions.*,
                   accounts.account_number,
                   customers.full_name
            FROM transactions
            JOIN accounts ON accounts.id=transactions.account_id
            JOIN customers ON customers.id=accounts.customer_id
            ORDER BY transactions.id DESC LIMIT 8
        """).fetchall()

    content = """
    <div class="card hero mb-4">
        <h1>Welcome to NovaBank.</h1>
        <p>Manage customers, accounts and payroll from one
        professional banking workspace.</p>
        <a href="/customers" class="btn btn-light mt-2">
            Register a customer
        </a>
    </div>

    <div class="row g-3 mb-4">

        <div class="col-md-3 col-6">
            <div class="card stat-card">
                <div class="stat-icon">
                    <i class="bi bi-people"></i>
                </div>
                <div class="muted">Total customers</div>
                <div class="metric">{{ customers }}</div>
            </div>
        </div>

        <div class="col-md-3 col-6">
            <div class="card stat-card">
                <div class="stat-icon">
                    <i class="bi bi-wallet2"></i>
                </div>
                <div class="muted">Accounts</div>
                <div class="metric">{{ accounts }}</div>
            </div>
        </div>

        <div class="col-md-3 col-6">
            <div class="card stat-card">
                <div class="stat-icon">
                    <i class="bi bi-bank"></i>
                </div>
                <div class="muted">Total balances</div>
                <div class="metric" style="font-size:19px">
                    {{ balance }}
                </div>
            </div>
        </div>

        <div class="col-md-3 col-6">
            <div class="card stat-card">
                <div class="stat-icon">
                    <i class="bi bi-cash-stack"></i>
                </div>
                <div class="muted">Payroll recorded</div>
                <div class="metric" style="font-size:19px">
                    {{ salaries }}
                </div>
            </div>
        </div>

    </div>

    <div class="card p-4">

        <h5>Recent transactions</h5>

        <div class="table-responsive">
        <table class="table">

            <thead>
                <tr>
                    <th>Customer</th>
                    <th>Account</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Date</th>
                </tr>
            </thead>

            <tbody>
                {% for t in recent %}
                <tr>
                    <td>{{ t.full_name }}</td>
                    <td>{{ t.account_number }}</td>
                    <td>{{ t.description }}</td>
                    <td>{{ t.amount }}</td>
                    <td>{{ t.created_at }}</td>
                </tr>
                {% else %}
                <tr>
                    <td colspan="5" class="muted">
                        No transactions recorded yet.
                    </td>
                </tr>
                {% endfor %}
            </tbody>

        </table>
        </div>

    </div>
    """

    recent_data = [
        dict(t, amount=money(t["amount_cents"]))
        for t in recent
    ]

    return show_page(
        "Overview",
        "dashboard",
        content,
        customers=customers,
        accounts=accounts,
        balance=money(balance),
        salaries=money(salaries),
        recent=recent_data
    )


# =========================
# CUSTOMER MANAGEMENT
# =========================

@app.route("/customers", methods=["GET", "POST"])
def customers_page():

    if request.method == "POST":

        name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip().lower()
        phone = request.form.get("phone", "").strip()

        if not all([name, email, phone]):
            flash("Please complete all customer details.")

        else:
            try:
                with connect() as con:
                    con.execute("""
                        INSERT INTO customers
                        (full_name,email,phone,created_at)
                        VALUES(?,?,?,?)
                    """, (name, email, phone, timestamp()))

                flash("Customer successfully registered.")

            except sqlite3.IntegrityError:
                flash("This email address already exists.")

        return redirect(url_for("customers_page"))

    with connect() as con:
        people = con.execute(
            "SELECT * FROM customers ORDER BY id DESC"
        ).fetchall()

    content = """
    <div class="row g-4">

        <div class="col-lg-4">
            <div class="card p-4">

                <h5>Register customer</h5>

                <form method="POST">

                    <label class="form-label mt-3">
                        Full name
                    </label>

                    <input class="form-control"
                           name="full_name"
                           required>

                    <label class="form-label mt-3">
                        Email address
                    </label>

                    <input class="form-control"
                           type="email"
                           name="email"
                           required>

                    <label class="form-label mt-3">
                        Phone number
                    </label>

                    <input class="form-control"
                           name="phone"
                           required>

                    <button class="btn btn-primary w-100 mt-4">
                        Create customer
                    </button>

                </form>

            </div>
        </div>

        <div class="col-lg-8">
            <div class="card p-4">

                <h5>Customer directory</h5>

                <div class="table-responsive">
                <table class="table">

                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                        </tr>
                    </thead>

                    <tbody>
                    {% for p in people %}
                        <tr>
                            <td>{{ p.full_name }}</td>
                            <td>{{ p.email }}</td>
                            <td>{{ p.phone }}</td>
                        </tr>
                    {% else %}
                        <tr>
                            <td colspan="3">
                                No customers registered.
                            </td>
                        </tr>
                    {% endfor %}
                    </tbody>

                </table>
                </div>

            </div>
        </div>

    </div>
    """

    return show_page(
        "Customer Management",
        "customers",
        content,
        people=people
    )


# =========================
# ACCOUNT MANAGEMENT
# =========================

@app.route("/accounts", methods=["GET", "POST"])
def accounts_page():

    if request.method == "POST":

        try:
            customer_id = int(request.form["customer_id"])
            account_type = request.form["account_type"]

            if account_type not in ["Savings", "Current"]:
                raise ValueError

            with connect() as con:

                customer = con.execute(
                    "SELECT id FROM customers WHERE id=?",
                    (customer_id,)
                ).fetchone()

                if not customer:
                    raise ValueError

                account_number = "NB" + "".join(
                    secrets.choice("0123456789")
                    for _ in range(10)
                )

                con.execute("""
                    INSERT INTO accounts
                    (customer_id,account_number,account_type,
                     balance_cents,created_at)
                    VALUES(?,?,?,?,?)
                """, (
                    customer_id,
                    account_number,
                    account_type,
                    0,
                    timestamp()
                ))

            flash("Account created: " + account_number)

        except (ValueError, KeyError):
            flash("Please select a valid customer and account type.")

        return redirect(url_for("accounts_page"))

    with connect() as con:

        people = con.execute(
            "SELECT id,full_name FROM customers ORDER BY full_name"
        ).fetchall()

        accounts = con.execute("""
            SELECT accounts.*,
                   customers.full_name
            FROM accounts
            JOIN customers
            ON customers.id=accounts.customer_id
            ORDER BY accounts.id DESC
        """).fetchall()

    content = """
    <div class="row g-4">

        <div class="col-lg-4">
            <div class="card p-4">

                <h5>Create account</h5>

                {% if people %}

                <form method="POST">

                    <label class="form-label mt-3">
                        Select customer
                    </label>

                    <select class="form-select"
                            name="customer_id" required>

                        {% for p in people %}
                        <option value="{{ p.id }}">
                            {{ p.full_name }}
                        </option>
                        {% endfor %}

                    </select>

                    <label class="form-label mt-3">
                        Account type
                    </label>

                    <select class="form-select"
                            name="account_type">

                        <option>Savings</option>
                        <option>Current</option>

                    </select>

                    <button class="btn btn-primary w-100 mt-4">
                        Create account
                    </button>

                </form>

                {% else %}

                <p class="muted">
                    Register a customer first.
                </p>

                {% endif %}

            </div>
        </div>

        <div class="col-lg-8">
            <div class="card p-4">

                <h5>Account register</h5>

                <div class="table-responsive">
                <table class="table">

                    <thead>
                        <tr>
                            <th>Account number</th>
                            <th>Customer</th>
                            <th>Type</th>
                            <th>Balance</th>
                        </tr>
                    </thead>

                    <tbody>

                    {% for a in accounts %}
                        <tr>
                            <td>{{ a.account_number }}</td>
                            <td>{{ a.full_name }}</td>
                            <td>
                                <span class="badge badge-blue">
                                    {{ a.account_type }}
                                </span>
                            </td>
                            <td>{{ a.balance }}</td>
                        </tr>
                    {% else %}
                        <tr>
                            <td colspan="4">
                                No accounts created.
                            </td>
                        </tr>
                    {% endfor %}

                    </tbody>

                </table>
                </div>

            </div>
        </div>

    </div>
    """

    formatted = [
        dict(a, balance=money(a["balance_cents"]))
        for a in accounts
    ]

    return show_page(
        "Account Management",
        "accounts",
        content,
        people=people,
        accounts=formatted
    )


# =========================
# SALARY MANAGEMENT
# =========================

@app.route("/salaries", methods=["GET", "POST"])
def salaries_page():

    if request.method == "POST":

        try:
            account_id = int(request.form["account_id"])
            amount = convert_money(request.form["amount"])
            period = request.form.get("pay_period", "").strip()

            if not period:
                raise ValueError

            with connect() as con:

                account = con.execute(
                    "SELECT customer_id FROM accounts WHERE id=?",
                    (account_id,)
                ).fetchone()

                if not account:
                    raise ValueError

                now = timestamp()

                # Simulated salary credit
                con.execute("""
                    UPDATE accounts
                    SET balance_cents = balance_cents + ?
                    WHERE id=?
                """, (amount, account_id))

                # Transaction record
                con.execute("""
                    INSERT INTO transactions
                    (account_id,kind,amount_cents,
                     description,created_at)
                    VALUES(?,?,?,?,?)
                """, (
                    account_id,
                    "SALARY",
                    amount,
                    "Salary payment - " + period,
                    now
                ))

                # Payroll history
                con.execute("""
                    INSERT INTO salaries
                    (customer_id,account_id,amount_cents,
                     pay_period,status,created_at)
                    VALUES(?,?,?,?,?,?)
                """, (
                    account["customer_id"],
                    account_id,
                    amount,
                    period,
                    "PAID",
                    now
                ))

            flash("Salary successfully recorded in the demo ledger.")

        except (ValueError, KeyError):
            flash("Check the account, amount and pay period.")

        return redirect(url_for("salaries_page"))

    with connect() as con:

        accounts = con.execute("""
            SELECT accounts.id,
                   accounts.account_number,
                   customers.full_name
            FROM accounts
            JOIN customers
            ON customers.id=accounts.customer_id
            ORDER BY customers.full_name
        """).fetchall()

        salaries = con.execute("""
            SELECT salaries.*,
                   customers.full_name,
                   accounts.account_number
            FROM salaries
            JOIN customers
            ON customers.id=salaries.customer_id
            JOIN accounts
            ON accounts.id=salaries.account_id
            ORDER BY salaries.id DESC
        """).fetchall()

    content = """
    <div class="row g-4">

        <div class="col-lg-4">
            <div class="card p-4">

                <h5>Record salary</h5>

                {% if accounts %}

                <form method="POST">

                    <label class="form-label mt-3">
                        Employee account
                    </label>

                    <select class="form-select"
                            name="account_id" required>

                        {% for a in accounts %}
                        <option value="{{ a.id }}">
                            {{ a.full_name }} -
                            {{ a.account_number }}
                        </option>
                        {% endfor %}

                    </select>

                    <label class="form-label mt-3">
                        Salary amount (KSh)
                    </label>

                    <input class="form-control"
                           type="number"
                           name="amount"
                           min="0.01"
                           step="0.01"
                           required>

                    <label class="form-label mt-3">
                        Pay period
                    </label>

                    <input class="form-control"
                           name="pay_period"
                           placeholder="November 2026"
                           required>

                    <button class="btn btn-primary w-100 mt-4">
                        Record salary
                    </button>

                </form>

                {% else %}

                <p class="muted">
                    Create an account first.
                </p>

                {% endif %}

                <p class="muted mt-3">
                    Demo salary payments only. No real bank
                    transfer takes place.
                </p>

            </div>
        </div>

        <div class="col-lg-8">
            <div class="card p-4">

                <h5>Payroll history</h5>

                <div class="table-responsive">
                <table class="table">

                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Account</th>
                            <th>Period</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>

                    {% for s in salaries %}
                        <tr>
                            <td>{{ s.full_name }}</td>
                            <td>{{ s.account_number }}</td>
                            <td>{{ s.pay_period }}</td>
                            <td>{{ s.amount }}</td>
                            <td>
                                <span class="badge badge-green">
                                    {{ s.status }}
                                </span>
                            </td>
                        </tr>
                    {% else %}
                        <tr>
                            <td colspan="5">
                                No salary records available.
                            </td>
                        </tr>
                    {% endfor %}

                    </tbody>

                </table>
                </div>

            </div>
        </div>

    </div>
    """

    formatted = [
        dict(s, amount=money(s["amount_cents"]))
        for s in salaries
    ]

    return show_page(
        "Salary Management",
        "Payroll",
        "salaries",
        content,
        accounts=accounts,
        salaries=formatted
    )


# =========================
# START APPLICATION
# =========================

if __name__ == "__main__":

    initialize()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
