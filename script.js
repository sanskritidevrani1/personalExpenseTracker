const DEFAULT_EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Shopping',
  'Travel',
  'Bills & Utilities',
  'Education',
  'Entertainment',
  'Healthcare',
  'Others'
];
const DEFAULT_INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Gift'];
const DEFAULT_PAYMENT_OPTIONS = ['Credit Card', 'Online', 'Cash', 'Bank'];
const CATEGORY_ALIASES = {
  food: 'Food & Dining',
  bills: 'Bills & Utilities',
  other: 'Others'
};

let transactions = [];
let monthlyBudgets = {};
let currentUser = null;
let chartRegistry = {};
let budgetRefreshId = 0;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_COLORS = {
  blue: '#638CFF',
  green: '#42C99A',
  red: '#F07878',
  purple: '#8B8CEE',
  orange: '#F2B94B',
  teal: '#4EC7C1',
  soft: '#A7B8D8',
  slate: '#60708A'
};

const expensePalette = ['#638CFF', '#42C99A', '#F2B94B', '#F07878', '#7A8FF7', '#5FD0C0', '#B58AF8', '#C9C6FF'];

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

function formatMonthKey(date) {
  const d = new Date(date + 'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isoDate(dateObj) {
  const date = new Date(dateObj);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthDisplayName(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });
}

async function loadTransactions() {
  const result = await apiRequest(`/transactions/${currentUser.user_id}`);
  transactions = result.map((row) => {
    const description = String(row.description || '');
    const [title, ...notes] = description.split('\n');
    const payment = String(row.payment_type || '');
    const paymentLabels = {
      online: 'Online',
      'credit card': 'Credit Card',
      cash: 'Cash',
      bank: 'Bank',
      'bank transfer': 'Bank'
    };

    return {
      id: Number(row.txn_id),
      title: title || 'Transaction',
      notes: notes.join('\n'),
      date: String(row.txn_date).slice(0, 10),
      category: row.category || 'Others',
      type: row.type,
      amount: Number(row.amount),
      payment: paymentLabels[payment.toLowerCase()] || payment || 'Online / UPI'
    };
  });
}

async function loadBudgets() {
  const result = await apiRequest(`/budgets/${currentUser.user_id}`);
  const loaded = {};

  result.forEach((row) => {
    const month = `${row.year}-${String(row.month).padStart(2, '0')}`;
    if (!loaded[month]) loaded[month] = { total: 0, totalId: null, categories: {}, categoryIds: {} };
    if (row.category === '__TOTAL__') {
      loaded[month].total = Number(row.limit_amount);
      loaded[month].totalId = Number(row.budget_id);
    } else {
      loaded[month].categories[row.category] = Number(row.limit_amount);
      loaded[month].categoryIds[row.category] = Number(row.budget_id);
    }
  });

  monthlyBudgets = loaded;
}

function getSelectedBudgetMonth() {
  return document.getElementById('budgetMonthSelect')?.value || getCurrentMonthKey();
}

function getBudgetMonthKeys() {
  const months = new Set(Object.keys(monthlyBudgets));
  transactions.forEach((item) => {
    if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      months.add(item.date.slice(0, 7));
    }
  });
  return [...months].sort((a, b) => b.localeCompare(a));
}

function initializeBudgetControls() {
  const categorySelect = document.getElementById('budgetCategorySelect');
  if (categorySelect) {
    categorySelect.innerHTML = DEFAULT_EXPENSE_CATEGORIES
      .map((category) => `<option value="${category}">${category}</option>`)
      .join('');
  }

  refreshBudgetMonthOptions();
}

function refreshBudgetMonthOptions() {
  const monthSelect = document.getElementById('budgetMonthSelect');
  if (!monthSelect) return;

  const selectedMonth = monthSelect.value || getCurrentMonthKey();
  const months = [...new Set([getCurrentMonthKey(), ...getBudgetMonthKeys()])]
    .sort((a, b) => b.localeCompare(a));
  monthSelect.innerHTML = months
    .map((month) => `<option value="${month}">${getMonthDisplayName(month)}</option>`)
    .join('');
  monthSelect.value = months.includes(selectedMonth) ? selectedMonth : getCurrentMonthKey();
}

function getBudgetMonthSummary(monthKey) {
  const budget = monthlyBudgets[monthKey] || { total: 0, categories: {} };
  const categorySpent = {};
  let spent = 0;

  transactions.forEach((item) => {
    if (item.type !== 'expense' || !item.date || !item.date.startsWith(monthKey)) return;
    const amount = Number(item.amount) || 0;
    const category = CATEGORY_ALIASES[String(item.category || '').toLowerCase()]
      || (DEFAULT_EXPENSE_CATEGORIES.includes(item.category) ? item.category : 'Others');
    spent += amount;
    categorySpent[category] = (categorySpent[category] || 0) + amount;
  });

  return {
    totalBudget: Number(budget.total) || 0,
    categoryBudgets: budget.categories || {},
    spent,
    categorySpent
  };
}

function renderBudgetAlert(status, message) {
  const alert = document.getElementById('budgetAlert');
  if (!alert) return;
  alert.className = `budget-alert ${status}`;
  alert.textContent = message;
}

function updateCategoryBudgetForm() {
  const categorySelect = document.getElementById('budgetCategorySelect');
  const amountInput = document.getElementById('categoryBudgetInput');
  const saveButton = document.getElementById('categoryBudgetSaveBtn');
  if (!categorySelect || !amountInput || !saveButton) return;

  const monthBudget = monthlyBudgets[getSelectedBudgetMonth()];
  const amount = monthBudget?.categories?.[categorySelect.value];
  amountInput.value = amount || '';
  saveButton.textContent = amount ? 'Update category budget' : 'Save category budget';
}

async function saveBudgetRecord(category, amount, monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const monthBudget = monthlyBudgets[monthKey];
  const budgetId = category === '__TOTAL__'
    ? monthBudget?.totalId
    : monthBudget?.categoryIds?.[category];
  await apiRequest(budgetId ? `/budgets/${budgetId}` : '/budgets', {
    method: budgetId ? 'PUT' : 'POST',
    body: JSON.stringify({ category, month, year, limit_amount: amount })
  });
  await loadBudgets();
  refreshBudgetMonthOptions();
  renderBudgetDashboard();
  refreshBudgetDashboard();
}

async function removeBudgetRecord(budgetId) {
  await apiRequest(`/budgets/${budgetId}`, { method: 'DELETE' });
  await loadBudgets();
  refreshBudgetMonthOptions();
  renderBudgetDashboard();
  refreshBudgetDashboard();
}

function renderCategoryBudgetRows(summary, categoryStatuses = {}) {
  const tableBody = document.getElementById('categoryBudgetTableBody');
  const emptyState = document.getElementById('categoryBudgetEmptyState');
  if (!tableBody) return;

  const rows = DEFAULT_EXPENSE_CATEGORIES
    .filter((category) => Number(summary.categoryBudgets[category]) > 0)
    .map((category) => {
      const limit = Number(summary.categoryBudgets[category]);
      const spent = categoryStatuses[category]?.totalSpent ?? summary.categorySpent[category] ?? 0;
      const percentage = (spent / limit) * 100;
      const status = categoryStatuses[category]?.status === 'exceeded' || percentage >= 100
        ? { label: 'Exceeded', className: 'danger' }
        : categoryStatuses[category]?.status === 'nearing_limit' || percentage >= 80
          ? { label: 'Near limit', className: 'warning' }
          : { label: 'On track', className: '' };

      return `
        <tr>
          <td>${category}</td>
          <td>${formatINR(limit)}</td>
          <td>${formatINR(spent)}</td>
          <td class="budget-row-status ${status.className}">${status.label}</td>
          <td>
            <div class="action-group">
              <button class="action-btn edit" data-action="edit-category-budget" data-category="${category}" type="button">Edit</button>
              <button class="action-btn delete" data-action="delete-category-budget" data-category="${category}" type="button">Delete</button>
            </div>
          </td>
        </tr>
      `;
    });

  tableBody.innerHTML = rows.join('');
  if (emptyState) emptyState.hidden = rows.length > 0;
}

function renderBudgetHistory() {
  const tableBody = document.getElementById('budgetHistoryTableBody');
  const emptyState = document.getElementById('budgetHistoryEmptyState');
  if (!tableBody) return;

  const months = getBudgetMonthKeys();
  tableBody.innerHTML = months.map((month) => {
    const summary = getBudgetMonthSummary(month);
    const remaining = summary.totalBudget - summary.spent;
    const remainingLabel = summary.totalBudget
      ? remaining >= 0 ? formatINR(remaining) : `${formatINR(Math.abs(remaining))} over`
      : '—';

    return `
      <tr>
        <td>${getMonthDisplayName(month)}</td>
        <td>${summary.totalBudget ? formatINR(summary.totalBudget) : '—'}</td>
        <td>${formatINR(summary.spent)}</td>
        <td>${remainingLabel}</td>
        <td><button class="action-btn" data-action="view-budget-month" data-month="${month}" type="button">View</button></td>
      </tr>
    `;
  }).join('');

  if (emptyState) emptyState.hidden = months.length > 0;
}

function drawBudgetComparisonChart(summary) {
  const canvas = document.getElementById('budgetComparisonChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const categoryNames = DEFAULT_EXPENSE_CATEGORIES.filter((category) =>
    Number(summary.categoryBudgets[category]) > 0 || Number(summary.categorySpent[category]) > 0
  );
  const labels = ['Monthly total', ...categoryNames];
  const planned = [summary.totalBudget, ...categoryNames.map((category) => Number(summary.categoryBudgets[category]) || 0)];
  const actual = [summary.spent, ...categoryNames.map((category) => summary.categorySpent[category] || 0)];

  if (chartRegistry.budgetComparison) chartRegistry.budgetComparison.destroy();
  chartRegistry.budgetComparison = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Planned budget',
          data: planned,
          backgroundColor: 'rgba(99, 140, 255, 0.82)',
          borderRadius: 6
        },
        {
          label: 'Actual expenses',
          data: actual,
          backgroundColor: 'rgba(240, 120, 120, 0.82)',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#969EAE', boxWidth: 10 }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatINR(context.parsed.y)}`
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
            callback: (value) => formatCompactINR(value)
          }
        }
      }
    }
  });
}

function renderBudgetDashboard(categoryStatuses = {}) {
  const month = getSelectedBudgetMonth();
  const summary = getBudgetMonthSummary(month);
  const percent = summary.totalBudget > 0 ? (summary.spent / summary.totalBudget) * 100 : 0;
  const usedPercent = Math.round(percent);
  const remaining = summary.totalBudget - summary.spent;
  const monthTitle = document.getElementById('budgetOverviewMonth');
  const monthlyBudgetValue = document.getElementById('monthlyBudgetValue');
  const monthlySpentValue = document.getElementById('monthlySpentValue');
  const monthlyRemainingValue = document.getElementById('monthlyRemainingValue');
  const progress = document.getElementById('monthlyBudgetProgress');
  const progressFill = document.getElementById('monthlyBudgetProgressFill');
  const progressLabel = document.getElementById('monthlyBudgetProgressLabel');
  const progressPercent = document.getElementById('monthlyBudgetProgressPercent');
  const monthlyInput = document.getElementById('monthlyBudgetInput');
  const deleteMonthlyButton = document.getElementById('deleteMonthlyBudgetBtn');
  const saveMonthlyButton = document.getElementById('monthlyBudgetSaveBtn');

  if (monthTitle) monthTitle.textContent = getMonthDisplayName(month);
  if (monthlyBudgetValue) monthlyBudgetValue.textContent = summary.totalBudget ? formatINR(summary.totalBudget) : 'Not set';
  if (monthlySpentValue) monthlySpentValue.textContent = formatINR(summary.spent);
  if (monthlyRemainingValue) {
    monthlyRemainingValue.textContent = summary.totalBudget
      ? remaining >= 0 ? formatINR(remaining) : `${formatINR(Math.abs(remaining))} over`
      : 'Set a budget';
  }
  if (monthlyInput) monthlyInput.value = summary.totalBudget || '';
  if (deleteMonthlyButton) deleteMonthlyButton.hidden = !summary.totalBudget;
  if (saveMonthlyButton) saveMonthlyButton.textContent = summary.totalBudget ? 'Update budget' : 'Save budget';
  if (progress) progress.setAttribute('aria-valuenow', String(Math.min(100, Math.max(0, percent))));
  if (progressFill) {
    progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    progressFill.className = `budget-progress-fill${percent >= 100 ? ' danger' : percent >= 80 ? ' warning' : ''}`;
  }
  if (progressLabel) progressLabel.textContent = summary.totalBudget ? `${formatINR(summary.spent)} spent` : 'No monthly budget set';
  if (progressPercent) progressPercent.textContent = summary.totalBudget ? `${usedPercent}% used` : '0%';

  if (!summary.totalBudget) {
    renderBudgetAlert('info', 'Set a monthly budget to enable spending alerts.');
  } else if (percent >= 100) {
    renderBudgetAlert('danger', `Budget exceeded by ${formatINR(Math.abs(remaining))}.`);
  } else if (percent >= 80) {
    renderBudgetAlert('warning', `Warning: ${usedPercent}% of this month's budget has been used.`);
  } else {
    renderBudgetAlert('info', 'You are within your monthly spending budget.');
  }

  updateCategoryBudgetForm();
  renderCategoryBudgetRows(summary, categoryStatuses);
  renderBudgetHistory();
  drawBudgetComparisonChart(summary);
}

async function refreshBudgetDashboard() {
  const refreshId = ++budgetRefreshId;
  const monthKey = getSelectedBudgetMonth();
  const [year, month] = monthKey.split('-').map(Number);
  const categories = Object.keys(monthlyBudgets[monthKey]?.categories || {});

  try {
    const statusEntries = await Promise.all(categories.map(async (category) => {
      const encodedCategory = encodeURIComponent(category);
      const [spending, budgetStatus] = await Promise.all([
        apiRequest(`/spending/${currentUser.user_id}/${encodedCategory}/${month}/${year}`),
        apiRequest(`/budget-check/${currentUser.user_id}/${encodedCategory}/${month}/${year}`)
      ]);
      return [category, {
        totalSpent: Number(spending.total_spent),
        status: budgetStatus.status
      }];
    }));

    if (refreshId !== budgetRefreshId) return;
    renderBudgetDashboard(Object.fromEntries(statusEntries));
  } catch (error) {
    showToast(`Could not refresh budget alerts: ${error.message}`, 'error');
  }
}

async function saveMonthlyBudget(event) {
  event.preventDefault();
  const amount = Number(document.getElementById('monthlyBudgetInput').value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast('Enter a monthly budget greater than zero.', 'error');
    return;
  }

  const button = document.getElementById('monthlyBudgetSaveBtn');
  button.disabled = true;
  button.textContent = 'Saving...';
  try {
    await saveBudgetRecord('__TOTAL__', amount, getSelectedBudgetMonth());
    showToast('Monthly budget saved.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = monthlyBudgets[getSelectedBudgetMonth()]?.total ? 'Update budget' : 'Save budget';
  }
}

async function deleteMonthlyBudget(event) {
  const month = getSelectedBudgetMonth();
  const budgetId = monthlyBudgets[month]?.totalId;
  if (!budgetId) return;
  if (!window.confirm(`Delete the total budget for ${getMonthDisplayName(month)}?`)) return;

  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Deleting...';
  try {
    await removeBudgetRecord(budgetId);
    showToast('Monthly budget deleted.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Delete';
  }
}

async function saveCategoryBudget(event) {
  event.preventDefault();
  const category = document.getElementById('budgetCategorySelect').value;
  const amount = Number(document.getElementById('categoryBudgetInput').value);
  if (!DEFAULT_EXPENSE_CATEGORIES.includes(category) || !Number.isFinite(amount) || amount <= 0) {
    showToast('Choose a category and enter a budget greater than zero.', 'error');
    return;
  }

  const button = document.getElementById('categoryBudgetSaveBtn');
  button.disabled = true;
  button.textContent = 'Saving...';
  try {
    await saveBudgetRecord(category, amount, getSelectedBudgetMonth());
    showToast(`${category} budget saved.`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = monthlyBudgets[getSelectedBudgetMonth()]?.categories?.[category]
      ? 'Update category budget'
      : 'Save category budget';
  }
}

function editCategoryBudget(category) {
  const monthBudget = monthlyBudgets[getSelectedBudgetMonth()];
  const amount = monthBudget?.categories?.[category];
  if (!amount) return;

  document.getElementById('budgetCategorySelect').value = category;
  document.getElementById('categoryBudgetInput').value = amount;
  document.getElementById('categoryBudgetSaveBtn').textContent = 'Update category budget';
  document.getElementById('categoryBudgetInput').focus();
}

async function deleteCategoryBudget(category, button) {
  const month = getSelectedBudgetMonth();
  const monthBudget = monthlyBudgets[month];
  const budgetId = monthBudget?.categoryIds?.[category];
  if (!budgetId) return;
  if (!window.confirm(`Delete the ${category} budget for ${getMonthDisplayName(month)}?`)) return;

  button.disabled = true;
  button.textContent = 'Deleting...';
  try {
    await removeBudgetRecord(budgetId);
    showToast(`${category} budget deleted.`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = 'Delete';
    }
  }
}

function getVisibleTransactions() {
  const range = document.getElementById('rangeSelect')?.value || '6m';
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
  const categorySelect = document.getElementById('txnCategory');
  const categoryFilter = document.getElementById('categoryFilter');
  if (!categorySelect && !categoryFilter) return;

  const transactionCategories = transactions.map((item) => item.category);
  const allValues = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...transactionCategories];
  const uniqueOptions = [...new Set(allValues)];

  if (categorySelect) {
    categorySelect.innerHTML = uniqueOptions
      .map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)
      .join('');
    categorySelect.value = 'Food & Dining';
  }

  if (categoryFilter) {
    const selected = categoryFilter.value || 'all';
    categoryFilter.innerHTML = `<option value="all">All categories</option>${uniqueOptions.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('')}`;
    categoryFilter.value = selected;
  }
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
  const previousIncome = previousPeriod.income;
  const previousExpense = previousPeriod.expense;
  const previousBalance = previousPeriod.balance;

  const balanceTrend = getRateChange(balance, previousBalance);
  const incomeTrend = getRateChange(income, previousIncome);
  const expenseTrend = getRateChange(expense, previousExpense);

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
  const range = document.getElementById('rangeSelect')?.value || '6m';
  const monthFilter = document.getElementById('monthSelect')?.value || 'all';
  const list = [...transactions];

  if (monthFilter !== 'all') {
    const currentMonth = monthFilter;
    const date = new Date(`${currentMonth}-01T00:00:00`);
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

  const current = list.filter((item) => new Date(item.date + 'T00:00:00') >= currentCutoff && new Date(item.date + 'T00:00:00') <= now);
  const previous = list.filter((item) => new Date(item.date + 'T00:00:00') >= previousCutoff && new Date(item.date + 'T00:00:00') < currentCutoff);

  const currentTotals = summarizeTotals(current);
  const previousTotals = summarizeTotals(previous);
  return {
    income: previousTotals.income,
    expense: previousTotals.expense,
    balance: previousTotals.balance
  };
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
  if (previousValue === 0) return currentValue ? 100 : 0;
  return ((currentValue - previousValue) / previousValue) * 100;
}

function drawMonthlyChart() {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx || typeof Chart === 'undefined') return;

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
  if (!ctx || typeof Chart === 'undefined') return;

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
        data: values,
        backgroundColor: labels.map((_, index) => expensePalette[index % expensePalette.length]),
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
  if (!ctx || typeof Chart === 'undefined') return;

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
  if (!ctx || typeof Chart === 'undefined') return;

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

function getFilteredTableData() {
  const searchValue = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const typeValue = document.getElementById('typeFilter')?.value || 'all';
  const categoryValue = document.getElementById('categoryFilter')?.value || 'all';
  const timeValue = document.getElementById('timeFilter')?.value || 'all';
  const sortValue = document.getElementById('sortFilter')?.value || 'newest';

  let filtered = [...transactions];

  if (searchValue) {
    filtered = filtered.filter((item) =>
      `${item.title} ${item.notes} ${item.category} ${item.amount} ${item.type} ${item.payment}`
        .toLowerCase()
        .includes(searchValue)
    );
  }

  if (typeValue !== 'all') {
    filtered = filtered.filter((item) => item.type === typeValue);
  }

  if (categoryValue !== 'all') {
    filtered = filtered.filter((item) => item.category === categoryValue);
  }

  if (timeValue !== 'all') {
    const days = Number(timeValue);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    filtered = filtered.filter((item) => new Date(item.date + 'T00:00:00') >= cutoff);
  }

  filtered.sort((a, b) => {
    const dateA = new Date(a.date + 'T00:00:00').getTime();
    const dateB = new Date(b.date + 'T00:00:00').getTime();
    if (sortValue === 'oldest') return dateA - dateB;
    if (sortValue === 'highest') return Number(b.amount) - Number(a.amount);
    if (sortValue === 'lowest') return Number(a.amount) - Number(b.amount);
    return dateB - dateA;
  });

  return filtered;
}

function renderTable() {
  const tableBody = document.getElementById('transactionTableBody');
  const emptyState = document.getElementById('emptyState');
  const emptyStateMessage = document.getElementById('emptyStateMessage');
  if (!tableBody) return;

  const rows = getFilteredTableData();

  tableBody.innerHTML = rows.map((item) => {
    const isIncome = item.type === 'income';
    const amountClass = isIncome ? 'income' : 'expense';
    const signedAmount = isIncome ? `+${formatINR(item.amount)}` : `-${formatINR(item.amount)}`;

    return `
      <tr>
        <td><span class="transaction-title">${escapeHTML(item.title)}</span></td>
        <td><span class="category-pill">${escapeHTML(item.category)}</span></td>
        <td>${new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${escapeHTML(getPaymentLabel(item.payment))}</td>
        <td class="amount-cell ${amountClass}">${signedAmount}</td>
        <td><span class="type-chip ${escapeHTML(item.type)}">${escapeHTML(item.type)}</span></td>
        <td>
          <div class="action-group">
            <button class="action-btn edit" data-action="edit" data-id="${item.id}" type="button">Edit</button>
            <button class="action-btn delete" data-action="delete" data-id="${item.id}" type="button">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (emptyState) {
    emptyState.hidden = rows.length > 0;
  }
  if (emptyStateMessage) {
    emptyStateMessage.textContent = transactions.length === 0
      ? 'No transactions yet. Add your first expense!'
      : 'No transactions match the selected filters.';
  }
}

function getPaymentLabel(payment) {
  const labels = {
    Online: 'Online / UPI',
    Bank: 'Bank Transfer'
  };
  return labels[payment] || payment;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2600);
}

function openModalForEdit(id) {
  const item = transactions.find((txn) => txn.id === Number(id));
  if (!item) return;

  const modal = document.getElementById('transactionModal');
  const title = document.getElementById('modalTitle');
  document.getElementById('editTxnId').value = item.id;
  document.getElementById('txnDescription').value = item.title;
  document.getElementById('txnAmount').value = item.amount;
  document.getElementById('txnDate').value = item.date;
  document.getElementById('txnCategory').value = item.category;
  document.getElementById('txnPaymentType').value = item.payment;
  document.getElementById('txnNotes').value = item.notes || '';

  const radio = document.querySelector(`input[name="txnType"][value="${item.type}"]`);
  if (radio) radio.checked = true;

  updateCategoryFieldBasedOnType();
  title.textContent = 'Edit Transaction';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function openModalForAdd() {
  const modal = document.getElementById('transactionModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('transactionForm');
  if (form) form.reset();
  document.getElementById('editTxnId').value = '';
  const today = isoDate(new Date());
  document.getElementById('txnDate').value = today;
  document.querySelector('input[name="txnType"][value="expense"]').checked = true;
  document.getElementById('txnCategory').value = 'Food & Dining';
  title.textContent = 'Add Transaction';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  const modal = document.getElementById('transactionModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function updateCategoryFieldBasedOnType() {
  const activeType = document.querySelector('input[name="txnType"]:checked')?.value || 'expense';
  const categoryField = document.getElementById('txnCategory');
  if (!categoryField) return;

  const defaults = activeType === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const savedCategories = transactions
    .filter((item) => item.type === activeType)
    .map((item) => item.category);
  const categories = [...new Set([...defaults, ...savedCategories])];
  const currentValue = categoryField.value;

  categoryField.innerHTML = categories
    .map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)
    .join('');
  if (categories.includes(currentValue)) {
    categoryField.value = currentValue;
  } else {
    categoryField.value = categories[0];
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const editId = document.getElementById('editTxnId').value;
  const title = document.getElementById('txnDescription').value.trim();
  const amount = Number(document.getElementById('txnAmount').value);
  const date = document.getElementById('txnDate').value;
  const type = document.querySelector('input[name="txnType"]:checked')?.value || 'expense';
  const category = document.getElementById('txnCategory').value;
  const payment = document.getElementById('txnPaymentType').value;
  const notes = document.getElementById('txnNotes').value.trim();

  if (!title || !amount || amount <= 0 || !date) {
    showToast('Please complete every required field.', 'error');
    return;
  }

  const payload = {
    amount,
    type,
    category,
    description: notes ? `${title}\n${notes}` : title,
    txn_date: date,
    payment_type: payment
  };

  const submitButton = document.getElementById('submitBtn');
  submitButton.disabled = true;
  submitButton.textContent = 'Saving...';
  try {
    await apiRequest(editId ? `/transactions/${editId}` : '/transactions', {
      method: editId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    await loadTransactions();
    refreshAll();
    closeModal();
    showToast(editId ? 'Transaction updated successfully.' : 'Transaction added successfully.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Save Transaction';
  }
}

async function importTransactions() {
  const input = document.getElementById('transactionImportInput');
  const button = document.getElementById('importTransactionsBtn');
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  button.disabled = true;
  button.textContent = 'Importing...';
  try {
    const result = await apiRequest('/import-transactions', {
      method: 'POST',
      body: formData
    });
    await loadTransactions();
    refreshAll();
    showToast(`${result.imported} transaction${result.imported === 1 ? '' : 's'} imported.`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    input.value = '';
    button.disabled = false;
    button.textContent = 'Import CSV/Excel';
  }
}

async function deleteTransaction(id, button) {
  const target = transactions.find((item) => item.id === Number(id));
  if (!target) return;

  const confirmed = window.confirm(`Delete "${target.title}" from your records?`);
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = 'Deleting...';
  try {
    await apiRequest(`/transactions/${id}`, { method: 'DELETE' });
    await loadTransactions();
    refreshAll();
    showToast('Transaction deleted.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = 'Delete';
    }
  }
}

function refreshAll() {
  initializeCategoryOptions();
  refreshBudgetMonthOptions();
  renderTable();
  updateSummary();
  updateCharts();
  renderBudgetDashboard();
  refreshBudgetDashboard();
}

function bindEvents() {
  const typeInputs = document.querySelectorAll('input[name="txnType"]');
  typeInputs.forEach((input) => {
    input.addEventListener('change', updateCategoryFieldBasedOnType);
  });

  document.getElementById('addTransactionBtn')?.addEventListener('click', openModalForAdd);
  document.getElementById('importTransactionsBtn')?.addEventListener('click', () => {
    document.getElementById('transactionImportInput')?.click();
  });
  document.getElementById('transactionImportInput')?.addEventListener('change', importTransactions);
  document.getElementById('logoutBtn')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Signing out...';
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      window.location.replace('/login');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Sign out';
    }
  });
  document.getElementById('cancelTransactionBtn')?.addEventListener('click', closeModal);
  document.querySelector('.icon-close')?.addEventListener('click', closeModal);
  document.getElementById('transactionForm')?.addEventListener('submit', handleFormSubmit);
  document.getElementById('monthlyBudgetForm')?.addEventListener('submit', saveMonthlyBudget);
  document.getElementById('deleteMonthlyBudgetBtn')?.addEventListener('click', deleteMonthlyBudget);
  document.getElementById('categoryBudgetForm')?.addEventListener('submit', saveCategoryBudget);
  document.getElementById('budgetCategorySelect')?.addEventListener('change', updateCategoryBudgetForm);
  document.getElementById('budgetMonthSelect')?.addEventListener('change', () => {
    renderBudgetDashboard();
    refreshBudgetDashboard();
  });
  document.getElementById('rangeSelect')?.addEventListener('change', () => {
    updateSummary();
    updateCharts();
  });
  document.getElementById('monthSelect')?.addEventListener('change', () => {
    updateSummary();
    updateCharts();
  });
  document.getElementById('searchInput')?.addEventListener('input', renderTable);
  document.getElementById('typeFilter')?.addEventListener('change', renderTable);
  document.getElementById('categoryFilter')?.addEventListener('change', renderTable);
  document.getElementById('timeFilter')?.addEventListener('change', renderTable);
  document.getElementById('sortFilter')?.addEventListener('change', renderTable);
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action;
    if (action === 'edit') {
      openModalForEdit(target.dataset.id);
    }
    if (action === 'delete') {
      deleteTransaction(target.dataset.id, target);
    }
    if (action === 'edit-category-budget') {
      editCategoryBudget(target.dataset.category);
    }
    if (action === 'delete-category-budget') {
      deleteCategoryBudget(target.dataset.category, target);
    }
    if (action === 'view-budget-month') {
      const monthSelect = document.getElementById('budgetMonthSelect');
      if (monthSelect) {
        monthSelect.value = target.dataset.month;
        renderBudgetDashboard();
        document.getElementById('budgets').scrollIntoView({ behavior: 'smooth' });
      }
    }
  });

  document.getElementById('transactionModal')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
}

async function initializePage() {
  initializeMonthSelector();
  initializeCategoryOptions();
  initializeBudgetControls();
  bindEvents();
  updateCategoryFieldBasedOnType();

  const today = isoDate(new Date());
  const txnDate = document.getElementById('txnDate');
  if (txnDate && !txnDate.value) txnDate.value = today;

  try {
    currentUser = await apiRequest('/auth/me');
    document.getElementById('signedInUser').textContent = currentUser.username || 'Signed in';

    try {
      localStorage.removeItem('user_expenses_v2');
      localStorage.removeItem('user_expenses');
      localStorage.removeItem('monthly_budgets_v1');
    } catch (error) {
      console.error('Unable to clear the previous browser-only transaction cache:', error);
    }

    await Promise.all([loadTransactions(), loadBudgets()]);
    refreshAll();
  } catch (error) {
    if (!window.location.pathname.startsWith('/login')) {
      showToast(error.message, 'error');
    }
  }
}

window.addEventListener('DOMContentLoaded', initializePage);
