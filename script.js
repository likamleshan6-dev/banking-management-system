
/* =========================================
   NOVABANK - BANKING MANAGEMENT SYSTEM
   Front-end educational demonstration
========================================= */

// DATABASE STORAGE
let customers = JSON.parse(localStorage.getItem("nbCustomers") || "[]");
let accounts = JSON.parse(localStorage.getItem("nbAccounts") || "[]");
let transactions = JSON.parse(localStorage.getItem("nbTransactions") || "[]");

// SAVE DATA
function saveData() {
    localStorage.setItem("nbCustomers", JSON.stringify(customers));
    localStorage.setItem("nbAccounts", JSON.stringify(accounts));
    localStorage.setItem("nbTransactions", JSON.stringify(transactions));
}

// GENERATE UNIQUE IDs
function generateID(prefix) {
    return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

// FORMAT CURRENCY
function money(amount) {
    return "KES " + Number(amount).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// SAFELY DISPLAY TEXT
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// NAVIGATION
function showPage(page, button) {
    document.querySelectorAll(".page").forEach(section => {
        section.classList.remove("active");
    });

    const selectedPage = document.getElementById(page);

    if (selectedPage) {
        selectedPage.classList.add("active");
    }

    document.querySelectorAll(".sidebar button").forEach(btn => {
        btn.classList.remove("active");
    });

    if (button) {
        button.classList.add("active");
    }
}

// REGISTER CUSTOMER
const customerForm = document.getElementById("customerForm");

if (customerForm) {
    customerForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const name = document.getElementById("customerName").value.trim();
        const email = document.getElementById("customerEmail").value.trim();
        const phone = document.getElementById("customerPhone").value.trim();

        if (!name || !email || !phone) {
            alert("Please complete all customer details.");
            return;
        }

        const existing = customers.some(c =>
            c.email.toLowerCase() === email.toLowerCase()
        );

        if (existing) {
            alert("This email is already registered.");
            return;
        }

        const customer = {
            id: generateID("NB-C"),
            name,
            email,
            phone,
            date: new Date().toLocaleDateString()
        };

        customers.push(customer);

        saveData();
        customerForm.reset();
        render();

        alert("Customer registered successfully!");
    });
}

// CREATE BANK ACCOUNT
const accountForm = document.getElementById("accountForm");

if (accountForm) {
    accountForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const customerId = document.getElementById("accountCustomer").value;
        const type = document.getElementById("accountType").value;

        if (!customerId) {
            alert("Please select a customer.");
            return;
        }

        const account = {
            number: generateID("NB"),
            customerId,
            type,
            balance: 0,
            date: new Date().toLocaleDateString()
        };

        accounts.push(account);

        saveData();
        accountForm.reset();
        render();

        alert("Bank account created successfully!");
    });
}

// UPDATE SALARY ACCOUNT LIST
function updateSalaryAccounts() {
    const customerSelect = document.getElementById("salaryCustomer");
    const accountSelect = document.getElementById("salaryAccount");

    if (!customerSelect || !accountSelect) return;

    const customerId = customerSelect.value;

    const customerAccounts = accounts.filter(account =>
        account.customerId === customerId
    );

    accountSelect.innerHTML =
        '<option value="">Select account</option>' +
        customerAccounts.map(account => `
            <option value="${account.number}">
                ${escapeHTML(account.number)} - ${escapeHTML(account.type)}
            </option>
        `).join("");
}

// SALARY CUSTOMER CHANGE
const salaryCustomer = document.getElementById("salaryCustomer");

if (salaryCustomer) {
    salaryCustomer.addEventListener("change", updateSalaryAccounts);
}

// PROCESS SALARY
const salaryForm = document.getElementById("salaryForm");

if (salaryForm) {
    salaryForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const accountNumber = document.getElementById("salaryAccount").value;
        const amount = Number(document.getElementById("salaryAmount").value);
        const month = document.getElementById("salaryMonth").value;

        const account = accounts.find(a => a.number === accountNumber);

        if (!account || !Number.isFinite(amount) || amount <= 0 || !month) {
            alert("Please enter valid salary details.");
            return;
        }

        account.balance += amount;

        const transaction = {
            reference: generateID("NB-T"),
            account: account.number,
            type: "Salary Credit",
            amount,
            date: month,
            recordedAt: new Date().toISOString()
        };

        transactions.unshift(transaction);

        saveData();
        salaryForm.reset();
        render();

        alert("Salary successfully recorded!");
    });
}

// RENDER DASHBOARD
function render() {
    updateDashboard();
    renderCustomers();
    renderAccounts();
    renderTransactions();
    updateDropdowns();
}

// DASHBOARD STATISTICS
function updateDashboard() {
    const customerCount = document.getElementById("customerCount");
    const accountCount = document.getElementById("accountCount");
    const salaryTotal = document.getElementById("salaryTotal");
    const balanceTotal = document.getElementById("balanceTotal");

    const totalSalary = transactions
        .filter(t => t.type === "Salary Credit")
        .reduce((sum, t) => sum + t.amount, 0);

    const totalBalance = accounts
        .reduce((sum, a) => sum + a.balance, 0);

    if (customerCount) customerCount.textContent = customers.length;
    if (accountCount) accountCount.textContent = accounts.length;
    if (salaryTotal) salaryTotal.textContent = money(totalSalary);
    if (balanceTotal) balanceTotal.textContent = money(totalBalance);
}

// DISPLAY CUSTOMERS
function renderCustomers() {
    const table = document.getElementById("customerTable");

    if (!table) return;

    table.innerHTML = customers.map(customer => `
        <tr>
            <td>${escapeHTML(customer.id)}</td>
            <td>${escapeHTML(customer.name)}</td>
            <td>${escapeHTML(customer.email)}</td>
            <td>${escapeHTML(customer.phone)}</td>
        </tr>
    `).join("");
}

// DISPLAY ACCOUNTS
function renderAccounts() {
    const table = document.getElementById("accountTable");

    if (!table) return;

    table.innerHTML = accounts.map(account => {
        const customer = customers.find(c => c.id === account.customerId);

        return `
            <tr>
                <td>${escapeHTML(account.number)}</td>
                <td>${customer ? escapeHTML(customer.name) : "Unknown"}</td>
                <td>${escapeHTML(account.type)}</td>
                <td>${money(account.balance)}</td>
            </tr>
        `;
    }).join("");
}

// DISPLAY TRANSACTIONS
function renderTransactions() {
    const table = document.getElementById("transactionTable");

    if (!table) return;

    table.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${escapeHTML(transaction.reference)}</td>
            <td>${escapeHTML(transaction.account)}</td>
            <td>${escapeHTML(transaction.type)}</td>
            <td>${money(transaction.amount)}</td>
            <td>${escapeHTML(transaction.date)}</td>
        </tr>
    `).join("");
}

// UPDATE CUSTOMER DROPDOWNS
function updateDropdowns() {
    const accountCustomer = document.getElementById("accountCustomer");
    const salaryCustomer = document.getElementById("salaryCustomer");

    const options = customers.map(customer => `
        <option value="${escapeHTML(customer.id)}">
            ${escapeHTML(customer.name)}
        </option>
    `).join("");

    if (accountCustomer) {
        const selected = accountCustomer.value;
        accountCustomer.innerHTML =
            '<option value="">Select customer</option>' + options;
        if (customers.some(c => c.id === selected)) {
            accountCustomer.value = selected;
        }
    }

    if (salaryCustomer) {
        const selected = salaryCustomer.value;
        salaryCustomer.innerHTML =
            '<option value="">Select person</option>' + options;
        if (customers.some(c => c.id === selected)) {
            salaryCustomer.value = selected;
        }
    }

    updateSalaryAccounts();
}

// INITIALIZE NOVABANK
document.addEventListener("DOMContentLoaded", function() {
    render();
});

