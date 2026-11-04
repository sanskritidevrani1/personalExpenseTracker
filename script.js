const API = 'http://127.0.0.1:5000';
const USER_ID = localStorage.getItem('user_id');
if (!USER_ID) window.location.replace('login.html');

// Match these names with the categories used in your budgets / data_processing.py
const DEFAULT_EXPENSE_CATEGORIES = [
  'Food',
  'Shopping',
  'Travel',
  'Bills',
  'Education',
  'Entertainment',
  'Healthcare',
  'Others'
];
const DEFAULT_INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Gift'];
const PAYMENT_OPTIONS = [
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online / Card' },
  { value: 'cash', label: 'Cash' }
];
const SORT_MAP = {
  newest: { by: 'txn_date', order: 'desc' },
  oldest: { by: 'txn_date', order: 'asc' },
  highest: { by: 'amount', order: 'desc' },
  lowest: { by: 'amount', order: 'asc' }
};

let transactions = [];
let serverSorted = null;
let overrideList = null;
let topActive = false;
let searchTimer = null;
let chartRegistry = {};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const expensePalette = ['#638CFF', '#42C99A', '#F2B94B', '#F07878', '#7A8FF7', '#5FD0C0', '#B58AF8', '#C9C6FF'];

/* ---------------- API helpers ---------------- */

async function api(path, options = {}) {
  const config = { ...options };
  if (config.body) config.headers = { 'Content-Type': 'application/json' };
  const res = await fetch(API + path, config);
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error((data && data.message) || 'Request failed');
  return data;
}

function mapTxn(t) {
  return {
    id: t.txn_id,
    title: t.description || '(no description)',
    date: String(t.txn_date).slice(0, 10),
    category: t.category || 'Others',
    type: t.type,
    amount: Number(t.amount),
    payment: t.payment_type || '',
    notes: ''
  };
}

function paymentLabel(value) {
  const found = PAYMENT_OPTIONS.find((p) => p.value === String(value).toLowerCase());
  return found ? found.label : value;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

async function loadSorted() {
  const sortValue = document.getElementById('sortFilter')?.value || 'newest';
  const { by, order } = SORT_MAP[sortValue];
  const list = await api(`/transactions/${USER_ID}/sort?by=${by}&order=${order}`);
  serverSorted = list.map(mapTxn);
}

async function refreshData() {
  const list = await api(`/transactions/${USER_ID}`);
  transactions = list.map(mapTxn);
  overrideList = null;
  resetTopButton();
  await loadSorted();
  refreshAll();
  await refreshBudgets();
}

/* ---------------- formatting ---------------- */

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function formatCompactINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(amount);
}

function isoDate(dateObj) {
  return new Date(dateObj).toISOString().split('T')[0];
}

/* ---------------- filters / selectors ---------------- */

function getVisibleTransactions() {
  const range = document.getElementById('rangeSelect')?.value || 'all';
  const monthFilter = document.getElementById('monthSelect')?.value || 'all';
  const list = [...transactions];

  if (monthFilter !== 'all') {
    return list.filter((item) => item.date.startsWith(monthFilter));
  }

  const now = new Date();
  const rangeDays = { '1m': 30, '3m': 90, '6m': 180, all: 36500 };
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - rangeDays[range]);

  return list.filter((item) => new Date(item.date + 'T00:00:00') >= cutoff);
}

function initializeCategoryOptions() {
  const categoryFilter = document.getElementById('categoryFilter');
  if (!categoryFilter) return;

  const allValues = [
    ...DEFAULT_EXPENSE_CATEGORIES,
    ...DEFAULT_INCOME_CATEGORIES,
    ...transactions.map((t) => t.category)
  ];
  const uniqueOptions = [...new Set(allValues)];

  const selected = categoryFilter.value || 'all';
  categoryFilter.innerHTML = `<option value="all">All categories</option>${uniqueOptions
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}`;
  categoryFilter.value = uniqueOptions.includes(selected) ? selected : 'all';
}

function initializePaymentOptions() {
  const select = document.getElementById('txnPaymentType');
  if (!select) return;
  select.innerHTML = PAYMENT_OPTIONS.map((p) => `<option value="${p.value}">${p.label}</option>`).join('');
}

function initializeMonthSelector() {
  const monthSelect = document.getElementById('monthSelect');
  if (!monthSelect) return;

  const months = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 6; i += 1) {
    const label = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    months.unshift(label);
    cursor.setMonth(cursor.getMonth() - 1);
  }

  const options = ['<option value="all">All months</option>']
    .concat(
      months.map((month) => {
        const yearMonth = new Date(`${month}-01T00:00:00`);
        return `<option value="${month}">${MONTH_NAMES[yearMonth.getMonth()]} ${yearMonth.getFullYear()}</option>`;
      })
    );

  monthSelect.innerHTML = options.join('');
  monthSelect.value = 'all';
}

/* ---------------- summary cards ---------------- */

function updateSummary() {
  const visible = getVisibleTransactions();

  let income = 0;
  let expense = 0;

  visible.forEach((item) => {
    const amount = Number(item.amount) || 0;
    if (item.type === 'income') income += amount;
    else expense += amount;
  });

  const balance = income - expense;
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
  const previousPeriod = getComparisonPeriodTransactions();

  const balanceTrend = getRateChange(balance, previousPeriod.balance);
  const incomeTrend = getRateChange(income, previousPeriod.income);
  const expenseTrend = getRateChange(expense, previousPeriod.expense);

  const balanceEl = document.getElementById('totalBalance');
  const incomeEl = document.getElementById('totalIncome');
  const expenseEl = document.getElementById('totalExpense');
  const savingsEl = document.getElementById('savingsRate');
  const balanceTrendEl = document.getElementById('balanceTrend');
  const incomeTrendEl = document.getElementById('incomeTrend');
  const expenseTrendEl = document.getElementById('expenseTrend');
  const savingsTrendEl = document.getElementById('savingsTrend');

  if (balanceEl) balanceEl.textContent = formatINR(balance);
  if (incomeEl) incomeEl.textContent = formatINR(income);
  if (expenseEl) expenseEl.textContent = formatINR(expense);
  if (savingsEl) savingsEl.textContent = `${Math.max(0, Math.round(savingsRate))}%`;

  if (balanceTrendEl) balanceTrendEl.textContent = `${balanceTrend >= 0 ? '+' : ''}${balanceTrend.toFixed(1)}% vs last period`;
  if (incomeTrendEl) incomeTrendEl.textContent = `${incomeTrend >= 0 ? '+' : ''}${incomeTrend.toFixed(1)}% vs last period`;
  if (expenseTrendEl) expenseTrendEl.textContent = `${expenseTrend >= 0 ? '+' : ''}${expenseTrend.toFixed(1)}% vs last period`;

  if (savingsTrendEl) {
    savingsTrendEl.textContent = savingsRate >= 25 ? 'Healthy allocation' : savingsRate >= 15 ? 'Balanced spending' : 'Watch discretionary spend';
  }

  balanceTrendEl?.classList.toggle('positive', balanceTrend >= 0);
  balanceTrendEl?.classList.toggle('negative', balanceTrend < 0);
  incomeTrendEl?.classList.toggle('positive', incomeTrend >= 0);
  incomeTrendEl?.classList.toggle('negative', incomeTrend < 0);
  expenseTrendEl?.classList.toggle('positive', expenseTrend <= 0);
  expenseTrendEl?.classList.toggle('negative', expenseTrend > 0);
}

function getComparisonPeriodTransactions() {
  const range = document.getElementById('rangeSelect')?.value || 'all';
  const monthFilter = document.getElementById('monthSelect')?.value || 'all';
  const list = [...transactions];

  if (monthFilter !== 'all') {
    const date = new Date(`${monthFilter}-01T00:00:00`);
    const previousDate = new Date(date);
    previousDate.setMonth(previousDate.getMonth() - 1);
    const prevKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
    return summarizeTotals(list.filter((item) => item.date.startsWith(prevKey)));
  }

  const now = new Date();
  const rangeDays = { '1m': 30, '3m': 90, '6m': 180, all: 36500 };
  const currentCutoff = new Date(now);
  currentCutoff.setDate(now.getDate() - rangeDays[range]);
  const previousCutoff = new Date(now);
  previousCutoff.setDate(now.getDate() - rangeDays[range] * 2);

  const previous = list.filter((item) => new Date(item.date + 'T00:00:00') >= previousCutoff && new Date(item.date + 'T00:00:00') < currentCutoff);
  return summarizeTotals(previous);
}

function summarizeTotals(items) {
  let income = 0;
  let expense = 0;

  items.forEach((item) => {
    const amount = Number(item.amount) || 0;
    if (item.type === 'income') income += amount;
    else expense += amount;
  });

  return { income, expense, balance: income - expense };
}

function getRateChange(currentValue, previousValue) {
  if (!previousValue) return currentValue ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

/* ---------------- charts ---------------- */

function drawMonthlyChart() {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;

  const months = getLastMonths(6);
  const incomeValues = months.map((monthKey) => getMonthTotals(monthKey).income);
  const expenseValues = months.map((monthKey) => getMonthTotals(monthKey).expense);

  if (chartRegistry.monthly) chartRegistry.monthly.destroy();

  chartRegistry.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map((monthKey) => monthLabel(monthKey)),
      datasets: [
        {
          label: 'Income',
          data: incomeValues,
          backgroundColor: 'rgba(66, 201, 154, 0.9)',
          borderRadius: 8,
          maxBarThickness: 18
        },
        {
          label: 'Expenses',
          data: expenseValues,
          backgroundColor: 'rgba(240, 120, 120, 0.82)',
          borderRadius: 8,
          maxBarThickness: 18
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#969EAE', boxWidth: 10 },
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatCompactINR(context.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#969EAE' }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
          ticks: {
            color: '#969EAE',
            callback: (value) => `₹${Math.round(value / 1000)}k`
          }
        }
      }
    }
  });
}

function getMonthTotals(monthKey) {
  const match = transactions.filter((item) => item.date.startsWith(monthKey));
  return summarizeTotals(match);
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} '${String(year).slice(-2)}`;
}

function getLastMonths(length) {
  const months = [];
  const date = new Date();
  date.setDate(1);
  for (let i = length - 1; i >= 0; i -= 1) {
    const monthDate = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    months.push(monthKey);
  }
  return months;
}

function drawExpenseBreakdownChart() {
  const ctx = document.getElementById('expenseBreakdownChart');
  if (!ctx) return;

  const visible = getVisibleTransactions().filter((item) => item.type === 'expense');
  const totals = {};

  visible.forEach((item) => {
    const key = item.category || 'Others';
    totals[key] = (totals[key] || 0) + Number(item.amount || 0);
  });

  const labels = Object.keys(totals);
  const values = Object.values(totals);

  if (chartRegistry.breakdown) chartRegistry.breakdown.destroy();

  chartRegistry.breakdown = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['No data'],
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: labels.length ? labels.map((_, index) => expensePalette[index % expensePalette.length]) : ['#303746'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#969EAE', boxWidth: 10, padding: 12 }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatINR(context.parsed)}`
          }
        }
      }
    }
  });
}

function drawSpendingTrendChart() {
  const ctx = document.getElementById('spendingTrendChart');
  if (!ctx) return;

  const visible = getVisibleTransactions().filter((item) => item.type === 'expense');
  const sorted = [...visible].sort((a, b) => new Date(a.date) - new Date(b.date));
  const grouped = {};

  sorted.forEach((item) => {
    grouped[item.date] = (grouped[item.date] || 0) + Number(item.amount || 0);
  });

  const labels = Object.keys(grouped);
  const values = labels.map((key) => grouped[key]);

  if (chartRegistry.spendingTrend) chartRegistry.spendingTrend.destroy();

  chartRegistry.spendingTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map((date) => new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      datasets: [{
        label: 'Expenses',
        data: values,
        fill: false,
        borderColor: '#638CFF',
        backgroundColor: '#638CFF',
        pointRadius: 3,
        pointBackgroundColor: '#638CFF',
        borderWidth: 2,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${formatINR(context.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#969EAE', maxTicksLimit: 6 }
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
          ticks: {
            color: '#969EAE',
            callback: (value) => `₹${Math.round(value / 1000)}k`
          }
        }
      }
    }
  });
}

function drawCategoryComparisonChart() {
  const ctx = document.getElementById('categoryComparisonChart');
  if (!ctx) return;

  const visible = getVisibleTransactions().filter((item) => item.type === 'expense');
  const grouped = {};

  visible.forEach((item) => {
    grouped[item.category] = (grouped[item.category] || 0) + Number(item.amount || 0);
  });

  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([name]) => name);
  const values = entries.map(([, value]) => value);

  if (chartRegistry.categoryComparison) chartRegistry.categoryComparison.destroy();

  chartRegistry.categoryComparison = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: '#638CFF',
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatINR(context.parsed.x)
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
          ticks: {
            color: '#969EAE',
            callback: (value) => `₹${Math.round(value / 1000)}k`
          }
        },
        y: {
          ticks: { color: '#969EAE' },
          grid: { display: false }
        }
      }
    }
  });
}

function updateCharts() {
  drawMonthlyChart();
  drawExpenseBreakdownChart();
  drawSpendingTrendChart();
  drawCategoryComparisonChart();
}

/* ---------------- table ---------------- */

function getFilteredTableData() {
  if (overrideList) return overrideList;

  const searchValue = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const typeValue = document.getElementById('typeFilter')?.value || 'all';
  const categoryValue = document.getElementById('categoryFilter')?.value || 'all';
  const timeValue = document.getElementById('timeFilter')?.value || 'all';
  const sortValue = document.getElementById('sortFilter')?.value || 'newest';

  let filtered = [...(serverSorted || transactions)];

  if (searchValue) {
    filtered = filtered.filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(searchValue));
  }
  if (typeValue !== 'all') {
    filtered = filtered.filter((item) => item.type === typeValue);
  }
  if (categoryValue !== 'all') {
    filtered = filtered.filter((item) => item.category === categoryValue);
  }
  if (timeValue !== 'all') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(timeValue));
    filtered = filtered.filter((item) => new Date(item.date + 'T00:00:00') >= cutoff);
  }

  if (!serverSorted) {
    filtered.sort((a, b) => {
      const dateA = new Date(a.date + 'T00:00:00').getTime();
      const dateB = new Date(b.date + 'T00:00:00').getTime();
      if (sortValue === 'oldest') return dateA - dateB;
      if (sortValue === 'highest') return Number(b.amount) - Number(a.amount);
      if (sortValue === 'lowest') return Number(a.amount) - Number(b.amount);
      return dateB - dateA;
    });
  }

  return filtered;
}

function renderTable() {
  const tableBody = document.getElementById('transactionTableBody');
  const emptyState = document.getElementById('emptyState');
  if (!tableBody) return;

  const rows = getFilteredTableData();

  tableBody.innerHTML = rows.map((item) => {
    const isIncome = item.type === 'income';
    const amountClass = isIncome ? 'income' : 'expense';
    const signedAmount = isIncome ? `+${formatINR(item.amount)}` : `-${formatINR(item.amount)}`;

    return `
      <tr>
        <td><span class="transaction-title">${escapeHtml(item.title)}</span></td>
        <td><span class="category-pill">${escapeHtml(item.category)}</span></td>
        <td>${new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${escapeHtml(paymentLabel(item.payment))}</td>
        <td class="amount-cell ${amountClass}">${signedAmount}</td>
        <td><span class="type-chip ${item.type}">${item.type}</span></td>
        <td>
          <div class="action-group">
            <button class="action-btn edit" data-action="edit" data-id="${item.id}" type="button">Edit</button>
            <button class="action-btn delete" data-action="delete" data-id="${item.id}" type="button">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (emptyState) emptyState.hidden = rows.length > 0;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3200);
}

/* ---------------- modal ---------------- */

function ensureOption(select, value) {
  if (!select || value === undefined || value === null || value === '') return;
  const exists = [...select.options].some((o) => o.value === String(value));
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
}

function updateCategoryFieldBasedOnType() {
  const activeType = document.querySelector('input[name="txnType"]:checked')?.value || 'expense';
  const categoryField = document.getElementById('txnCategory');
  if (!categoryField) return;

  const categories = activeType === 'income'
    ? DEFAULT_INCOME_CATEGORIES
    : ['Auto', ...DEFAULT_EXPENSE_CATEGORIES];
  const currentValue = categoryField.value;

  categoryField.innerHTML = categories
    .map((c) => `<option value="${c}">${c === 'Auto' ? 'Auto-detect' : c}</option>`)
    .join('');
  categoryField.value = categories.includes(currentValue) ? currentValue : categories[0];
}

function openModalForEdit(id) {
  const item = transactions.find((txn) => txn.id === Number(id));
  if (!item) return;

  const modal = document.getElementById('transactionModal');
  document.getElementById('editTxnId').value = item.id;
  document.getElementById('txnDescription').value = item.title;
  document.getElementById('txnAmount').value = item.amount;
  document.getElementById('txnDate').value = item.date;

  const radio = document.querySelector(`input[name="txnType"][value="${item.type}"]`);
  if (radio) radio.checked = true;
  updateCategoryFieldBasedOnType();

  const categorySelect = document.getElementById('txnCategory');
  ensureOption(categorySelect, item.category);
  categorySelect.value = item.category;

  const paymentSelect = document.getElementById('txnPaymentType');
  ensureOption(paymentSelect, item.payment);
  paymentSelect.value = item.payment;

  document.getElementById('modalTitle').textContent = 'Edit Transaction';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function openModalForAdd() {
  const modal = document.getElementById('transactionModal');
  const form = document.getElementById('transactionForm');
  if (form) form.reset();
  document.getElementById('editTxnId').value = '';
  document.getElementById('txnDate').value = isoDate(new Date());
  document.querySelector('input[name="txnType"][value="expense"]').checked = true;
  updateCategoryFieldBasedOnType();
  document.getElementById('txnCategory').value = 'Auto';
  document.getElementById('modalTitle').textContent = 'Add Transaction';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  const modal = document.getElementById('transactionModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

/* ---------------- add / edit / delete (backend) ---------------- */

async function handleFormSubmit(event) {
  event.preventDefault();
  const editId = document.getElementById('editTxnId').value;
  const title = document.getElementById('txnDescription').value.trim();
  const amount = Number(document.getElementById('txnAmount').value);
  const date = document.getElementById('txnDate').value;
  const type = document.querySelector('input[name="txnType"]:checked')?.value || 'expense';
  const category = document.getElementById('txnCategory').value;
  const payment = document.getElementById('txnPaymentType').value;

  if (!title || !amount || amount <= 0 || !date) {
    showToast('Please complete every required field.', 'error');
    return;
  }

  const body = {
    user_id: Number(USER_ID),
    amount,
    type,
    category,
    description: title,
    txn_date: date,
    payment_type: payment
  };

  try {
    if (editId) {
      await api(`/transactions/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Transaction updated successfully.', 'success');
    } else {
      const res = await api('/transactions', { method: 'POST', body: JSON.stringify(body) });
      showToast(res.category ? `Transaction added (category: ${res.category})` : 'Transaction added successfully.', 'success');

      const alert = res.budget_alert;
      if (alert && alert.status !== 'within_budget') {
        const label = alert.status === 'exceeded' ? 'Budget exceeded' : 'Nearing budget limit';
        showToast(`${label}: spent ${formatINR(alert.total_spent)} of ${formatINR(alert.limit_amount)}`, 'error');
      }
    }
    closeModal();
    await refreshData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteTransaction(id) {
  const target = transactions.find((item) => item.id === Number(id));
  if (!target) return;

  const confirmed = window.confirm(`Delete "${target.title}" from your records?`);
  if (!confirmed) return;

  try {
    await api(`/transactions/${id}?user_id=${USER_ID}`, { method: 'DELETE' });
    showToast('Transaction deleted.', 'success');
    await refreshData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ---------------- search (binary search) / top expenses ---------------- */

function resetTopButton() {
  topActive = false;
  const btn = document.getElementById('topBtn');
  if (btn) btn.textContent = 'Top 5 Expenses';
}

function handleSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const value = (document.getElementById('searchInput')?.value || '').trim();
    try {
      if (/^\d+(\.\d+)?$/.test(value)) {
        const list = await api(`/transactions/${USER_ID}/search?amount=${value}`);
        overrideList = list.map(mapTxn);
        resetTopButton();
      } else if (!topActive) {
        overrideList = null;
      }
      renderTable();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }, 300);
}

async function toggleTop() {
  const btn = document.getElementById('topBtn');
  try {
    if (topActive) {
      overrideList = null;
      resetTopButton();
    } else {
      const list = await api(`/transactions/${USER_ID}/top?k=5`);
      overrideList = list.map(mapTxn);
      topActive = true;
      if (btn) btn.textContent = 'Show All';
      const search = document.getElementById('searchInput');
      if (search) search.value = '';
    }
    renderTable();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function addTopButton() {
  const row = document.querySelector('.filters-row');
  if (!row || document.getElementById('topBtn')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'topBtn';
  btn.className = 'secondary-btn';
  btn.textContent = 'Top 5 Expenses';
  btn.addEventListener('click', toggleTop);
  row.appendChild(btn);
}

/* ---------------- page wiring ---------------- */

function refreshAll() {
  initializeCategoryOptions();
  renderTable();
  updateSummary();
  updateCharts();
}

function setupUserBar() {
  const status = document.querySelector('.sidebar-status');
  if (!status) return;
  status.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  const label = document.createElement('span');
  label.textContent = ` ${localStorage.getItem('user_email') || 'User'} · `;
  const logout = document.createElement('a');
  logout.href = '#';
  logout.textContent = 'Logout';
  logout.style.color = 'inherit';
  logout.style.textDecoration = 'underline';
  logout.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    window.location.replace('login.html');
  });
  status.append(dot, label, logout);
}

function bindEvents() {
  document.querySelectorAll('input[name="txnType"]').forEach((input) => {
    input.addEventListener('change', updateCategoryFieldBasedOnType);
  });

  document.getElementById('addTransactionBtn')?.addEventListener('click', openModalForAdd);
  document.getElementById('cancelTransactionBtn')?.addEventListener('click', closeModal);
  document.querySelector('.icon-close')?.addEventListener('click', closeModal);
  document.getElementById('transactionForm')?.addEventListener('submit', handleFormSubmit);

  document.getElementById('rangeSelect')?.addEventListener('change', () => {
    updateSummary();
    updateCharts();
  });
  document.getElementById('monthSelect')?.addEventListener('change', () => {
    updateSummary();
    updateCharts();
  });

  document.getElementById('searchInput')?.addEventListener('input', handleSearchInput);
  document.getElementById('typeFilter')?.addEventListener('change', renderTable);
  document.getElementById('categoryFilter')?.addEventListener('change', renderTable);
  document.getElementById('timeFilter')?.addEventListener('change', renderTable);
  document.getElementById('sortFilter')?.addEventListener('change', async () => {
    try {
      overrideList = null;
      resetTopButton();
      await loadSorted();
      renderTable();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action;
    if (action === 'edit') openModalForEdit(target.dataset.id);
    if (action === 'delete') deleteTransaction(target.dataset.id);
  });

  document.getElementById('transactionModal')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
}

async function initializePage() {
  if (!USER_ID) return;

  setupUserBar();
  document.getElementById('resetDemoBtn')?.remove();
  document.getElementById('txnNotes')?.closest('.field-group')?.remove();
  const search = document.getElementById('searchInput');
  if (search) search.placeholder = 'Search text, or exact amount (binary search)';
  const range = document.getElementById('rangeSelect');
  if (range) range.value = 'all';

  initializeMonthSelector();
  initializePaymentOptions();
  initializeCategoryOptions();
  addTopButton();
  setupViews();
  bindEvents();
  updateCategoryFieldBasedOnType();
  updateSummary();
  updateCharts();

  const txnDate = document.getElementById('txnDate');
  if (txnDate && !txnDate.value) txnDate.value = isoDate(new Date());

  try {
    await refreshData();
  } catch (error) {
    showToast('Cannot reach server. Is python app.py running?', 'error');
  }
}
/* ================= Budgets + Import pages ================= */

const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BX_GRADIENTS = [
  '#7f5af0,#4f8cff',
  '#0f9b8e,#1cc88a',
  '#ee0979,#ff6a00',
  '#8e2de2,#c471ed',
  '#f2711c,#f5a623',
  '#2193b0,#4a9fe0',
  '#ff7eb3,#ff758c'
];

let budgets = [];
let budgetMonth = new Date().getMonth() + 1;
let budgetYear = new Date().getFullYear();
let selectedCsv = null;

function injectExtraStyles() {
  if (document.getElementById('extraStyles')) return;
  const style = document.createElement('style');
  style.id = 'extraStyles';
  style.textContent = `
    .bx-page { display:flex; flex-direction:column; gap:22px; color:#fff; }
    .bx-head h1 { font-size:1.9rem; margin:4px 0 0; }
    .bx-head p.sub { color:#a9b3c7; margin-top:6px; }
    .bx-toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
    .bx-input { background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:12px; padding:10px 14px; font-family:inherit; font-size:0.9rem; min-width:150px; }
    .bx-input:focus { outline:none; border-color:#ff7eb3; box-shadow:0 0 0 3px rgba(255,126,179,0.25); }
    .bx-input option { color:#111; background:#fff; }
    .bx-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:16px; }
    .bx-stat { border-radius:18px; padding:20px; color:#fff; box-shadow:0 10px 24px rgba(0,0,0,0.25); }
    .bx-stat small { opacity:0.9; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.07em; }
    .bx-stat strong { display:block; font-size:1.5rem; margin-top:8px; }
    .bx-stat.a { background:linear-gradient(135deg,#7f5af0,#4f8cff); }
    .bx-stat.b { background:linear-gradient(135deg,#0f9b8e,#2bb0ed); }
    .bx-stat.c { background:linear-gradient(135deg,#ff7eb3,#ff758c); }
    .bx-stat.d { background:linear-gradient(135deg,#f2711c,#f5a623); }
    .bx-alert { border-radius:14px; padding:12px 16px; font-size:0.9rem; font-weight:500; margin-bottom:8px; }
    .bx-alert.danger { background:rgba(255,90,120,0.2); border:1px solid rgba(255,100,120,0.55); color:#ffd5db; }
    .bx-alert.warn { background:rgba(255,196,60,0.16); border:1px solid rgba(255,196,60,0.55); color:#ffe7a8; }
    .bx-alert.ok { background:rgba(0,201,167,0.15); border:1px solid rgba(0,201,167,0.5); color:#b8fff0; }
    .bx-card { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:20px; }
    .bx-form { display:flex; flex-wrap:wrap; gap:14px; align-items:flex-end; }
    .bx-field { display:flex; flex-direction:column; gap:6px; font-size:0.78rem; color:#c3cde0; }
    .bx-btn { border:0; border-radius:12px; padding:11px 22px; font-weight:600; font-family:inherit; cursor:pointer; color:#fff; background:linear-gradient(135deg,#ff7a59,#ff3d81); box-shadow:0 8px 20px rgba(255,61,129,0.3); transition:transform 0.15s ease; }
    .bx-btn:hover { transform:translateY(-2px); }
    .bx-btn:disabled { opacity:0.6; cursor:wait; }
    .bx-btn.alt { background:linear-gradient(135deg,#7f5af0,#4f8cff); box-shadow:0 8px 20px rgba(79,140,255,0.3); }
    .bx-btn.ghost { background:rgba(255,255,255,0.1); box-shadow:none; }
    .bx-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:18px; }
    .bx-bcard { border-radius:20px; padding:20px; color:#fff; box-shadow:0 12px 28px rgba(0,0,0,0.3); }
    .bx-bcard h3 { margin:0; font-size:1.15rem; }
    .bx-top { display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .bx-row { display:flex; justify-content:space-between; font-size:0.86rem; margin-top:10px; }
    .bx-bar { height:10px; border-radius:99px; background:rgba(255,255,255,0.3); margin-top:16px; overflow:hidden; }
    .bx-bar span { display:block; height:100%; border-radius:99px; background:#fff; }
    .bx-chip { padding:4px 10px; border-radius:99px; font-size:0.72rem; font-weight:700; white-space:nowrap; }
    .bx-chip.ok { background:#0b3d2e; color:#7dffcf; }
    .bx-chip.warn { background:#4a3300; color:#ffd166; }
    .bx-chip.danger { background:#4a0d1a; color:#ff8fa3; }
    .bx-actions { display:flex; gap:8px; margin-top:16px; }
    .bx-mini { border:0; border-radius:10px; padding:7px 14px; font-weight:600; font-size:0.8rem; cursor:pointer; background:rgba(0,0,0,0.3); color:#fff; font-family:inherit; }
    .bx-mini:hover { background:rgba(0,0,0,0.5); }
    .bx-empty { text-align:center; padding:40px; border:2px dashed rgba(255,255,255,0.25); border-radius:20px; color:#c3cde0; grid-column:1 / -1; }
    .bx-drop { border:2px dashed rgba(196,113,237,0.8); border-radius:22px; padding:36px 20px; text-align:center; background:linear-gradient(135deg,rgba(127,90,240,0.18),rgba(255,61,129,0.14)); }
    .bx-drop h3 { margin:0 0 6px; font-size:1.25rem; }
    .bx-note { font-size:0.86rem; color:#c3cde0; line-height:1.7; }
    .bx-file { margin-top:12px; color:#ffd166; font-weight:600; }
    .bx-code { display:block; background:rgba(0,0,0,0.35); padding:12px 16px; border-radius:12px; font-family:monospace; font-size:0.82rem; color:#7dffcf; margin-top:10px; white-space:pre; overflow-x:auto; }
  `;
  document.head.appendChild(style);
}

function setupViews() {
  injectExtraStyles();

  const nav = document.querySelector('.sidebar-nav');
  if (nav) {
    nav.innerHTML = `
      <a href="#" class="nav-item active" data-view="dashboard"><span class="nav-icon">◫</span>Dashboard</a>
      <a href="#" class="nav-item" data-view="transactions"><span class="nav-icon">↔</span>Transactions</a>
      <a href="#" class="nav-item" data-view="budgets"><span class="nav-icon">◔</span>Budgets</a>
      <a href="#" class="nav-item" data-view="import"><span class="nav-icon">⇪</span>Import CSV</a>`;
    nav.addEventListener('click', (e) => {
      const link = e.target.closest('[data-view]');
      if (!link) return;
      e.preventDefault();
      showView(link.dataset.view);
    });
  }

  const main = document.querySelector('.main-panel');
  if (!main) return;

  const monthOptions = MONTH_FULL
    .map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');

  const budgetsView = document.createElement('section');
  budgetsView.id = 'budgetsView';
  budgetsView.className = 'bx-page';
  budgetsView.style.display = 'none';
  budgetsView.innerHTML = `
    <div class="bx-head">
      <p class="eyebrow">Planning</p>
      <h1>Budgets</h1>
      <p class="sub">Set a monthly limit for each category and track your spending against it.</p>
    </div>
    <div class="bx-toolbar">
      <select id="bxMonth" class="bx-input">${monthOptions}</select>
      <input id="bxYear" type="number" class="bx-input" style="min-width:110px;width:110px">
    </div>
    <div class="bx-stats" id="bxStats"></div>
    <div id="bxAlerts"></div>
    <div class="bx-card">
      <div class="bx-form">
        <label class="bx-field">Category<select id="bxCategory" class="bx-input"></select></label>
        <label class="bx-field">Monthly limit (₹)<input id="bxLimit" type="number" min="1" step="0.01" class="bx-input" placeholder="e.g. 5000"></label>
        <button id="bxSave" type="button" class="bx-btn">Set Limit</button>
      </div>
    </div>
    <div id="bxGrid" class="bx-grid"></div>`;

  const importView = document.createElement('section');
  importView.id = 'importView';
  importView.className = 'bx-page';
  importView.style.display = 'none';
  importView.innerHTML = `
    <div class="bx-head">
      <p class="eyebrow">Bulk upload</p>
      <h1>Import CSV</h1>
      <p class="sub">Upload a CSV of your expenses. If the category column is empty, categories are detected automatically.</p>
    </div>
    <div class="bx-drop">
      <h3>Choose a CSV file</h3>
      <p class="bx-note">Columns: date, amount, description, payment_type</p>
      <input type="file" id="bxFile" accept=".csv" hidden>
      <button type="button" class="bx-btn alt" id="bxPick">Browse file</button>
      <div class="bx-file" id="bxFileName">No file selected</div>
      <div style="margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="bx-btn" id="bxUpload" type="button">Upload &amp; Import</button>
        <button class="bx-btn ghost" id="bxSample" type="button">Download sample CSV</button>
      </div>
    </div>
    <div id="bxResult"></div>
    <div class="bx-card">
      <p class="bx-note"><strong>Sample format</strong></p>
      <code class="bx-code">date,amount,description,payment_type
2026-10-01,120.00,Bus pass recharge,upi
2026-10-03,250.00,Groceries,online
2026-10-05,80.00,Tea and snacks,cash</code>
    </div>`;

  main.append(budgetsView, importView);

  document.getElementById('bxMonth').value = budgetMonth;
  document.getElementById('bxYear').value = budgetYear;

  document.getElementById('bxMonth').addEventListener('change', (e) => {
    budgetMonth = Number(e.target.value);
    renderBudgets();
  });
  document.getElementById('bxYear').addEventListener('change', (e) => {
    const y = Number(e.target.value);
    if (y > 2000) {
      budgetYear = y;
      renderBudgets();
    }
  });
  document.getElementById('bxSave').addEventListener('click', saveBudget);
  budgetsView.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bx-action]');
    if (!btn) return;
    if (btn.dataset.bxAction === 'edit') editBudget(btn.dataset.id);
    if (btn.dataset.bxAction === 'delete') deleteBudget(btn.dataset.id);
  });

  document.getElementById('bxPick').addEventListener('click', () => document.getElementById('bxFile').click());
  document.getElementById('bxFile').addEventListener('change', (e) => {
    selectedCsv = e.target.files[0] || null;
    document.getElementById('bxFileName').textContent = selectedCsv ? selectedCsv.name : 'No file selected';
  });
  document.getElementById('bxUpload').addEventListener('click', runImport);
  document.getElementById('bxSample').addEventListener('click', downloadSample);
  importView.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) showView(go.dataset.goto);
  });

  showView('dashboard');
}

function showView(view) {
  const header = document.querySelector('.page-header');
  const summary = document.querySelector('.summary-cards-grid');
  const analytics = document.querySelector('.analytics-grid');
  const txnPanel = document.getElementById('transactions');
  const show = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };

  show(header, view === 'dashboard' || view === 'transactions');
  show(summary, view === 'dashboard');
  show(analytics, view === 'dashboard');
  show(txnPanel, view === 'transactions');
  show(document.getElementById('budgetsView'), view === 'budgets');
  show(document.getElementById('importView'), view === 'import');

  document.querySelectorAll('.sidebar-nav [data-view]').forEach((a) => {
    a.classList.toggle('active', a.dataset.view === view);
  });

  if (header) {
    const h1 = header.querySelector('h1');
    const eyebrow = header.querySelector('.eyebrow');
    if (h1) h1.textContent = view === 'transactions' ? 'Transactions' : 'Dashboard';
    if (eyebrow) eyebrow.textContent = view === 'transactions' ? 'Activity' : 'Overview';
    header.querySelectorAll('.period-picker').forEach((p) => {
      p.style.display = view === 'dashboard' ? '' : 'none';
    });
  }

  if (view === 'dashboard') updateCharts();
  if (view === 'budgets') renderBudgets();
  window.scrollTo(0, 0);
}

/* ---------- Budgets ---------- */

async function refreshBudgets() {
  try {
    budgets = await api(`/budgets/${USER_ID}`);
    await renderBudgets();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function getBudgetStatus(b) {
  try {
    return await api(`/budget-check/${USER_ID}/${encodeURIComponent(b.category)}/${b.month}/${b.year}`);
  } catch (e) {
    const prefix = `${b.year}-${String(b.month).padStart(2, '0')}`;
    const spent = transactions
      .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(prefix))
      .reduce((sum, t) => sum + t.amount, 0);
    let status = 'within_budget';
    if (spent >= b.limit_amount) status = 'exceeded';
    else if (spent >= 0.8 * b.limit_amount) status = 'nearing_limit';
    return { category: b.category, limit_amount: b.limit_amount, total_spent: spent, status };
  }
}

async function renderBudgets() {
  const grid = document.getElementById('bxGrid');
  if (!grid) return;

  const catSelect = document.getElementById('bxCategory');
  const currentCat = catSelect.value;
  const cats = [...new Set([
    ...DEFAULT_EXPENSE_CATEGORIES,
    ...transactions.filter((t) => t.type === 'expense').map((t) => t.category)
  ])];
  catSelect.innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (cats.includes(currentCat)) catSelect.value = currentCat;

  const list = budgets.filter((b) => Number(b.month) === budgetMonth && Number(b.year) === budgetYear);
  const stats = document.getElementById('bxStats');
  const alerts = document.getElementById('bxAlerts');

  if (!list.length) {
    stats.innerHTML = `
      <div class="bx-stat a"><small>Total budget</small><strong>${formatINR(0)}</strong></div>
      <div class="bx-stat b"><small>Spent so far</small><strong>${formatINR(0)}</strong></div>
      <div class="bx-stat c"><small>Remaining</small><strong>${formatINR(0)}</strong></div>
      <div class="bx-stat d"><small>Alerts</small><strong>0 exceeded · 0 nearing</strong></div>`;
    alerts.innerHTML = '';
    grid.innerHTML = `<div class="bx-empty">No budgets for ${MONTH_FULL[budgetMonth - 1]} ${budgetYear}.<br>Set your first limit above.</div>`;
    return;
  }

  const statuses = await Promise.all(list.map(getBudgetStatus));

  const totalLimit = list.reduce((s, b) => s + b.limit_amount, 0);
  const totalSpent = statuses.reduce((s, x) => s + x.total_spent, 0);
  const over = statuses.filter((x) => x.status === 'exceeded').length;
  const near = statuses.filter((x) => x.status === 'nearing_limit').length;

  stats.innerHTML = `
    <div class="bx-stat a"><small>Total budget</small><strong>${formatINR(totalLimit)}</strong></div>
    <div class="bx-stat b"><small>Spent so far</small><strong>${formatINR(totalSpent)}</strong></div>
    <div class="bx-stat c"><small>Remaining</small><strong>${formatINR(totalLimit - totalSpent)}</strong></div>
    <div class="bx-stat d"><small>Alerts</small><strong>${over} exceeded · ${near} nearing</strong></div>`;

  let alertHtml = '';
  statuses.forEach((s) => {
    if (s.status === 'exceeded') {
      alertHtml += `<div class="bx-alert danger">✖ ${escapeHtml(s.category)}: budget exceeded (${formatINR(s.total_spent)} of ${formatINR(s.limit_amount)})</div>`;
    } else if (s.status === 'nearing_limit') {
      alertHtml += `<div class="bx-alert warn">⚠ ${escapeHtml(s.category)}: nearing limit (${formatINR(s.total_spent)} of ${formatINR(s.limit_amount)})</div>`;
    }
  });
  if (!alertHtml) alertHtml = '<div class="bx-alert ok">✓ All budgets are on track.</div>';
  alerts.innerHTML = alertHtml;

  const chips = {
    within_budget: ['ok', '✓ On track'],
    nearing_limit: ['warn', '⚠ Nearing limit'],
    exceeded: ['danger', '✖ Exceeded']
  };

  grid.innerHTML = list.map((b, i) => {
    const s = statuses[i];
    const realPct = b.limit_amount > 0 ? Math.round((s.total_spent / b.limit_amount) * 100) : 0;
    const barPct = Math.min(100, realPct);
    const chip = chips[s.status] || chips.within_budget;
    const remaining = b.limit_amount - s.total_spent;

    return `
      <div class="bx-bcard" style="background:linear-gradient(135deg,${BX_GRADIENTS[i % BX_GRADIENTS.length]})">
        <div class="bx-top">
          <h3>${escapeHtml(b.category)}</h3>
          <span class="bx-chip ${chip[0]}">${chip[1]}</span>
        </div>
        <div class="bx-row"><span>Spent</span><strong>${formatINR(s.total_spent)}</strong></div>
        <div class="bx-row"><span>Limit</span><strong>${formatINR(b.limit_amount)}</strong></div>
        <div class="bx-row"><span>${remaining >= 0 ? 'Remaining' : 'Over by'}</span><strong>${formatINR(Math.abs(remaining))}</strong></div>
        <div class="bx-bar"><span style="width:${barPct}%"></span></div>
        <div class="bx-row"><span>${realPct}% used</span></div>
        <div class="bx-actions">
          <button class="bx-mini" type="button" data-bx-action="edit" data-id="${b.budget_id}">Edit limit</button>
          <button class="bx-mini" type="button" data-bx-action="delete" data-id="${b.budget_id}">Delete</button>
        </div>
      </div>`;
  }).join('');
}

async function saveBudget() {
  const category = document.getElementById('bxCategory').value;
  const limit = Number(document.getElementById('bxLimit').value);

  if (!category || !limit || limit <= 0) {
    showToast('Choose a category and enter a valid limit.', 'error');
    return;
  }

  try {
    const existing = budgets.find((b) =>
      b.category === category && Number(b.month) === budgetMonth && Number(b.year) === budgetYear);

    if (existing) {
      await api(`/budgets/${existing.budget_id}`, {
        method: 'PUT',
        body: JSON.stringify({ user_id: Number(USER_ID), limit_amount: limit })
      });
      showToast('Budget limit updated.', 'success');
    } else {
      await api('/budgets', {
        method: 'POST',
        body: JSON.stringify({
          user_id: Number(USER_ID),
          category,
          month: budgetMonth,
          year: budgetYear,
          limit_amount: limit
        })
      });
      showToast('Budget limit set.', 'success');
    }
    document.getElementById('bxLimit').value = '';
    await refreshBudgets();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function editBudget(id) {
  const b = budgets.find((x) => x.budget_id === Number(id));
  if (!b) return;

  const input = window.prompt(`New monthly limit for ${b.category} (₹):`, b.limit_amount);
  if (input === null) return;
  const limit = Number(input);
  if (!limit || limit <= 0) {
    showToast('Enter a valid limit.', 'error');
    return;
  }

  try {
    await api(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ user_id: Number(USER_ID), limit_amount: limit })
    });
    showToast('Budget limit updated.', 'success');
    await refreshBudgets();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteBudget(id) {
  const b = budgets.find((x) => x.budget_id === Number(id));
  if (!b) return;
  if (!window.confirm(`Delete the ${b.category} budget?`)) return;

  try {
    await api(`/budgets/${id}?user_id=${USER_ID}`, { method: 'DELETE' });
    showToast('Budget deleted.', 'success');
    await refreshBudgets();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ---------- CSV import ---------- */

async function runImport() {
  const result = document.getElementById('bxResult');
  const btn = document.getElementById('bxUpload');

  if (!selectedCsv) {
    showToast('Please choose a CSV file first.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('user_id', USER_ID);
  formData.append('file', selectedCsv);

  btn.disabled = true;
  btn.textContent = 'Importing...';

  try {
    const res = await fetch(API + '/import-transactions', { method: 'POST', body: formData });
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new Error(data.error || data.message || 'Import failed');

    result.innerHTML = `<div class="bx-alert ok">✓ ${data.imported} transactions imported successfully.
      <button type="button" class="bx-mini" style="margin-left:10px" data-goto="transactions">View transactions</button></div>`;
    showToast(`Imported ${data.imported} transactions.`, 'success');

    selectedCsv = null;
    document.getElementById('bxFile').value = '';
    document.getElementById('bxFileName').textContent = 'No file selected';
    await refreshData();
  } catch (error) {
    result.innerHTML = `<div class="bx-alert danger">✖ ${escapeHtml(error.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload & Import';
  }
}

function downloadSample() {
  const csv = [
    'date,amount,description,payment_type',
    '2026-10-01,120.00,Bus pass recharge,upi',
    '2026-10-03,250.00,Groceries,online',
    '2026-10-05,80.00,Tea and snacks,cash',
    '2026-10-07,450.00,Stationery and books,upi',
    '2026-10-09,150.00,Auto fare,cash'
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sample_transactions.csv';
  link.click();
  URL.revokeObjectURL(url);
}

window.addEventListener('DOMContentLoaded', initializePage);