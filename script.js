// Simple Expense Tracker Script (Beginner friendly)

// Starting sample data
let transactions = [
    { id: 1, date: '2026-10-01', desc: 'Monthly Salary', category: 'Salary', type: 'income', amount: 4000, payment: 'Bank' },
    { id: 2, date: '2026-10-04', desc: 'Grocery Shopping', category: 'Food & Dining', type: 'expense', amount: 540.00, payment: 'Credit Card' },
    { id: 3, date: '2026-10-05', desc: 'Electricity Bill', category: 'Bills & Utilities', type: 'expense', amount: 380.00, payment: 'Online' },
    { id: 4, date: '2026-10-06', desc: 'Uber Ride', category: 'Transportation', type: 'expense', amount: 180.00, payment: 'Online' },
    { id: 5, date: '2026-10-07', desc: 'Shopping at Mall', category: 'Shopping', type: 'expense', amount: 310.00, payment: 'Cash' },
    { id: 6, date: '2026-10-08', desc: 'Medical & Medicines', category: 'Other', type: 'expense', amount: 140.00, payment: 'Credit Card' }
];

let chartInstance = null;

// Run when page loads
window.onload = function() {
    // Load from browser storage if saved
    const saved = localStorage.getItem('user_expenses');
    if (saved) {
        try { transactions = JSON.parse(saved); } catch(e) {}
    }

    // Set today's date in date picker
    const dateInput = document.getElementById('txnDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    displayTransactions();
    updateSummary();
    drawChart();
};

// Save helper
function saveLocal() {
    localStorage.setItem('user_expenses', JSON.stringify(transactions));
}

// 1. Display transactions in table
function displayTransactions(list = transactions) {
    const tableBody = document.getElementById('transactionTableBody');
    const emptyState = document.getElementById('emptyState');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (list.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    // Show newest first
    const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(item => {
        const row = document.createElement('tr');
        const isIncome = item.type === 'income';
        const sign = isIncome ? '+' : '-';
        const colorClass = isIncome ? 'text-green' : 'text-red';

        row.innerHTML = `
            <td>${item.date}</td>
            <td><strong>${item.desc}</strong></td>
            <td><span class="category-pill">${item.category}</span></td>
            <td>${item.payment || 'Online'}</td>
            <td class="${colorClass}">${sign} ₹${parseFloat(item.amount).toFixed(2)}</td>
            <td class="text-center">
                <button class="action-btn edit-btn" onclick="editTransaction(${item.id})">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteTransaction(${item.id})">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 2. Update Total Balance, Income and Expenses
function updateSummary() {
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') income += amt;
        else expense += amt;
    });

    const balance = income - expense;

    const elBal = document.getElementById('totalBalance');
    const elInc = document.getElementById('totalIncome');
    const elExp = document.getElementById('totalExpense');

    if (elBal) elBal.textContent = `₹${balance.toFixed(2)}`;
    if (elInc) elInc.textContent = `+ ₹${income.toFixed(2)}`;
    if (elExp) elExp.textContent = `- ₹${expense.toFixed(2)}`;
}

// 3. Simple Chart using Chart.js
function drawChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;

    // Group expenses by category
    const totals = {};
    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            totals[t.category] = (totals[t.category] || 0) + parseFloat(t.amount);
        });

    const labels = Object.keys(totals);
    const data = Object.values(totals);

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['No Expenses Yet'],
            datasets: [{
                data: data.length ? data : [1],
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// 4. Add or Update Transaction
function handleFormSubmit(event) {
    event.preventDefault();

    const editId = document.getElementById('editTxnId').value;
    const type = document.querySelector('input[name="txnType"]:checked').value;
    const desc = document.getElementById('txnDescription').value.trim();
    const amount = parseFloat(document.getElementById('txnAmount').value);
    const date = document.getElementById('txnDate').value;
    const category = document.getElementById('txnCategory').value;
    const payment = document.getElementById('txnPaymentType').value;

    if (!desc || isNaN(amount) || amount <= 0 || !date) {
        alert('Please fill out all fields properly.');
        return;
    }

    if (editId) {
        // Edit existing
        const index = transactions.findIndex(t => t.id === parseInt(editId));
        if (index !== -1) {
            transactions[index] = { id: parseInt(editId), desc, amount, type, category, date, payment };
        }
    } else {
        // Add new
        const newId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
        transactions.push({ id: newId, desc, amount, type, category, date, payment });
    }

    saveLocal();
    displayTransactions();
    updateSummary();
    drawChart();
    resetForm();
}

// 5. Edit Button Handler
function editTransaction(id) {
    const item = transactions.find(t => t.id === id);
    if (!item) return;

    document.getElementById('editTxnId').value = item.id;
    document.getElementById('txnDescription').value = item.desc;
    document.getElementById('txnAmount').value = item.amount;
    document.getElementById('txnDate').value = item.date;
    document.getElementById('txnCategory').value = item.category;
    document.getElementById('txnPaymentType').value = item.payment;

    const radio = document.querySelector(`input[name="txnType"][value="${item.type}"]`);
    if (radio) radio.checked = true;

    document.getElementById('formTitle').textContent = 'Edit Transaction';
    document.getElementById('submitBtn').textContent = 'Update';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    document.getElementById('add-expense').scrollIntoView({ behavior: 'smooth' });
}

// 6. Reset Form
function resetForm() {
    document.getElementById('expenseForm').reset();
    document.getElementById('editTxnId').value = '';
    document.getElementById('txnDate').value = new Date().toISOString().split('T')[0];
    document.querySelector('input[name="txnType"][value="expense"]').checked = true;
    document.getElementById('formTitle').textContent = 'Add New Transaction';
    document.getElementById('submitBtn').textContent = 'Add Transaction';
    document.getElementById('cancelBtn').style.display = 'none';
}

// 7. Delete Transaction
function deleteTransaction(id) {
    if (confirm('Delete this transaction?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveLocal();
        displayTransactions();
        updateSummary();
        drawChart();
    }
}

// 8. Search & Category Filter
function filterTransactions() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const category = document.getElementById('categoryFilter').value;

    const filtered = transactions.filter(t => {
        const matchName = t.desc.toLowerCase().includes(query);
        const matchCat = (category === 'All') || (t.category === category);
        return matchName && matchCat;
    });

    displayTransactions(filtered);
}

// Change category preset on type toggle
function handleTypeChange() {
    const type = document.querySelector('input[name="txnType"]:checked').value;
    const catSelect = document.getElementById('txnCategory');
    if (type === 'income') {
        catSelect.value = 'Salary';
    } else {
        if (catSelect.value === 'Salary') {
            catSelect.value = 'Food & Dining';
        }
    }
}

function logout() {
    window.location.href = 'login.html';
}
