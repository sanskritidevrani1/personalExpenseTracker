const STORAGE_KEY = 'user_expenses_v2';
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
const DEFAULT_PAYMENT_OPTIONS = ['Credit Card', 'Online / UPI', 'Cash', 'Bank Transfer'];

let transactions = [];
let chartRegistry = {};

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

function getDateRangeLabel(value) {
  if (value === '1m') return 'This month';
  if (value === '3m') return 'Last 3 months';
  if (value === '6m') return 'Last 6 months';
  return 'All time';
}

function buildDemoTransactions() {
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - 5);

  const items = [
    { id: 101, title: 'Salary Deposit', date: isoDate(start), category: 'Salary', type: 'income', amount: 52000, payment: 'Bank Transfer', notes: 'Monthly salary' },
    { id: 102, title: 'Grocery Retail', date: addDays(isoDate(start), 3), category: 'Food & Dining', type: 'expense', amount: 3450, payment: 'Credit Card', notes: 'Weekly groceries' },
    { id: 103, title: 'Electricity Bill', date: addDays(isoDate(start), 6), category: 'Bills & Utilities', type: 'expense', amount: 4100, payment: 'Online / UPI', notes: 'June utility bill' },
    { id: 104, title: 'Metro Pass', date: addDays(isoDate(start), 9), category: 'Travel', type: 'expense', amount: 1800, payment: 'Online / UPI', notes: 'Transit card renewal' },
    { id: 105, title: 'Movie Night', date: addDays(isoDate(start), 12), category: 'Entertainment', type: 'expense', amount: 1450, payment: 'Credit Card', notes: 'Weekend plan' },
    { id: 106, title: 'Pharmacy', date: addDays(isoDate(start), 18), category: 'Healthcare', type: 'expense', amount: 980, payment: 'Cash', notes: 'Medicines' },
    { id: 107, title: 'Campus Course', date: addDays(isoDate(start), 21), category: 'Education', type: 'expense', amount: 6500, payment: 'Bank Transfer', notes: 'Certification course' },
    { id: 108, title: 'Freelance Design', date: addDays(isoDate(start), 25), category: 'Freelance', type: 'income', amount: 18000, payment: 'Bank Transfer', notes: 'Client retainer' },
    { id: 109, title: 'Online Shopping', date: addDays(isoDate(start), 31), category: 'Shopping', type: 'expense', amount: 5200, payment: 'Credit Card', notes: 'Home essentials' },
    { id: 110, title: 'Rent', date: addDays(isoDate(start), 33), category: 'Bills & Utilities', type: 'expense', amount: 24000, payment: 'Bank Transfer', notes: 'Apartment rent' },
    { id: 111, title: 'Fruit Market', date: addDays(isoDate(start), 38), category: 'Food & Dining', type: 'expense', amount: 2200, payment: 'Cash', notes: 'Fresh groceries' },
    { id: 112, title: 'Salary Deposit', date: addDays(isoDate(start), 39), category: 'Salary', type: 'income', amount: 52000, payment: 'Bank Transfer', notes: 'Monthly salary' },
    { id: 113, title: 'Restaurant Dinner', date: addDays(isoDate(start), 41), category: 'Food & Dining', type: 'expense', amount: 1800, payment: 'Credit Card', notes: 'Dinner with friends' },
    { id: 114, title: 'Flight Booking', date: addDays(isoDate(start), 47), category: 'Travel', type: 'expense', amount: 12800, payment: 'Online / UPI', notes: 'Weekend trip' },
    { id: 115, title: 'Coffee & Snacks', date: addDays(isoDate(start), 55), category: 'Food & Dining', type: 'expense', amount: 620, payment: 'Cash', notes: 'Office treats' },
    { id: 116, title: 'Gym Membership', date: addDays(isoDate(start), 60), category: 'Healthcare', type: 'expense', amount: 2600, payment: 'Online / UPI', notes: 'Monthly subscription' },
    { id: 117, title: 'Bonus', date: addDays(isoDate(start), 66), category: 'Salary', type: 'income', amount: 12000, payment: 'Bank Transfer', notes: 'Performance bonus' },
    { id: 118, title: 'Festival Shopping', date: addDays(isoDate(start), 70), category: 'Shopping', type: 'expense', amount: 9800, payment: 'Credit Card', notes: 'Festive purchases' },
    { id: 119, title: 'Streaming Bundle', date: addDays(isoDate(start), 72), category: 'Entertainment', type: 'expense', amount: 699, payment: 'Online / UPI', notes: 'Video subscription' },
    { id: 120, title: 'Consulting Income', date: addDays(isoDate(start), 79), category: 'Freelance', type: 'income', amount: 22000, payment: 'Bank Transfer', notes: 'Project milestone' },
    { id: 121, title: 'Tuition Fees', date: addDays(isoDate(start), 83), category: 'Education', type: 'expense', amount: 15400, payment: 'Bank Transfer', notes: 'Semester tuition' },
    { id: 122, title: 'Doctor Visit', date: addDays(isoDate(start), 88), category: 'Healthcare', type: 'expense', amount: 2400, payment: 'Credit Card', notes: 'Routine checkup' },
    { id: 123, title: 'Book Purchase', date: addDays(isoDate(start), 92), category: 'Education', type: 'expense', amount: 1500, payment: 'Online / UPI', notes: 'Study materials' },
    { id: 124, title: 'Salary Deposit', date: addDays(isoDate(start), 100), category: 'Salary', type: 'income', amount: 52000, payment: 'Bank Transfer', notes: 'Monthly salary' },
    { id: 125, title: 'Groceries', date: addDays(isoDate(start), 105), category: 'Food & Dining', type: 'expense', amount: 3900, payment: 'Credit Card', notes: 'Market groceries' },
    { id: 126, title: 'Taxi Ride', date: addDays(isoDate(start), 109), category: 'Travel', type: 'expense', amount: 1240, payment: 'Cash', notes: 'Airport transfer' },
    { id: 127, title: 'Game Subscription', date: addDays(isoDate(start), 113), category: 'Entertainment', type: 'expense', amount: 799, payment: 'Online / UPI', notes: 'Gaming subscription' },
    { id: 128, title: 'Water & Gas', date: addDays(isoDate(start), 116), category: 'Bills & Utilities', type: 'expense', amount: 3200, payment: 'Online / UPI', notes: 'Utility bill' },
    { id: 129, title: 'Weekend Sale', date: addDays(isoDate(start), 120), category: 'Shopping', type: 'expense', amount: 6800, payment: 'Credit Card', notes: 'Apparel shopping' },
    { id: 130, title: 'Gift Received', date: addDays(isoDate(start), 123), category: 'Gift', type: 'income', amount: 5000, payment: 'Cash', notes: 'Birthday gift' },
    { id: 131, title: 'Dining Out', date: addDays(isoDate(start), 130), category: 'Food & Dining', type: 'expense', amount: 2600, payment: 'Credit Card', notes: 'Dinner with family' },
    { id: 132, title: 'IPTV Renewal', date: addDays(isoDate(start), 136), category: 'Bills & Utilities', type: 'expense', amount: 1200, payment: 'Online / UPI', notes: 'Monthly internet' },
    { id: 133, title: 'Investment Return', date: addDays(isoDate(start), 140), category: 'Investment', type: 'income', amount: 15000, payment: 'Bank Transfer', notes: 'Stock dividends' }
  ];

  return items;
}

function isoDate(dateObj) {
  return new Date(dateObj).toISOString().split('T')[0];
}

function addDays(dateString, days) {
  const value = new Date(dateString + 'T00:00:00');
  value.setDate(value.getDate() + days);
  return isoDate(value);
}

function getSavedTransactions() {
  const fallback = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('user_expenses');
  if (!fallback) return null;

  try {
    const parsed = JSON.parse(fallback);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function initializeStorageAndData() {
  const saved = getSavedTransactions();
  transactions = saved && saved.length ? saved : buildDemoTransactions();
  saveTransactions();
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

  const allValues = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
  const uniqueOptions = [...new Set(allValues)];

  if (categorySelect) {
    categorySelect.innerHTML = uniqueOptions.map((category) => `<option value="${category}">${category}</option>`).join('');
    categorySelect.value = 'Food & Dining';
  }

  if (categoryFilter) {
    const selected = categoryFilter.value || 'all';
    categoryFilter.innerHTML = `<option value="all">All categories</option>${uniqueOptions.map((category) => `<option value="${category}">${category}</option>`).join('')}`;
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

function getFilteredTableData() {
  const searchValue = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const typeValue = document.getElementById('typeFilter')?.value || 'all';
  const categoryValue = document.getElementById('categoryFilter')?.value || 'all';
  const timeValue = document.getElementById('timeFilter')?.value || 'all';
  const sortValue = document.getElementById('sortFilter')?.value || 'newest';

  let filtered = [...transactions];

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
  if (!tableBody) return;

  const rows = getFilteredTableData();

  tableBody.innerHTML = rows.map((item) => {
    const isIncome = item.type === 'income';
    const amountClass = isIncome ? 'income' : 'expense';
    const signedAmount = isIncome ? `+${formatINR(item.amount)}` : `-${formatINR(item.amount)}`;

    return `
      <tr>
        <td><span class="transaction-title">${item.title}</span></td>
        <td><span class="category-pill">${item.category}</span></td>
        <td>${new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${item.payment}</td>
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

  if (emptyState) {
    emptyState.hidden = rows.length > 0;
  }
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

  const categories = activeType === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const currentValue = categoryField.value;

  categoryField.innerHTML = categories.map((category) => `<option value="${category}">${category}</option>`).join('');
  if (categories.includes(currentValue)) {
    categoryField.value = currentValue;
  } else {
    categoryField.value = categories[0];
  }
}

function handleFormSubmit(event) {
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
    id: editId ? Number(editId) : Date.now(),
    title,
    date,
    category,
    type,
    amount,
    payment,
    notes
  };

  if (editId) {
    transactions = transactions.map((item) => item.id === Number(editId) ? payload : item);
    showToast('Transaction updated successfully.', 'success');
  } else {
    transactions.push(payload);
    showToast('Transaction added successfully.', 'success');
  }

  saveTransactions();
  refreshAll();
  closeModal();
}

function deleteTransaction(id) {
  const target = transactions.find((item) => item.id === Number(id));
  if (!target) return;

  const confirmed = window.confirm(`Delete "${target.title}" from your records?`);
  if (!confirmed) return;

  transactions = transactions.filter((item) => item.id !== Number(id));
  saveTransactions();
  refreshAll();
  showToast('Transaction deleted.', 'success');
}

function refreshAll() {
  initializeCategoryOptions();
  renderTable();
  updateSummary();
  updateCharts();
}

function resetDemoData() {
  const confirmed = window.confirm('Reset all saved demo data? This will replace your current records.');
  if (!confirmed) return;

  transactions = buildDemoTransactions();
  saveTransactions();
  refreshAll();
  showToast('Demo data reset successfully.', 'success');
}

function bindEvents() {
  const typeInputs = document.querySelectorAll('input[name="txnType"]');
  typeInputs.forEach((input) => {
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
  document.getElementById('searchInput')?.addEventListener('input', renderTable);
  document.getElementById('typeFilter')?.addEventListener('change', renderTable);
  document.getElementById('categoryFilter')?.addEventListener('change', renderTable);
  document.getElementById('timeFilter')?.addEventListener('change', renderTable);
  document.getElementById('sortFilter')?.addEventListener('change', renderTable);
  document.getElementById('resetDemoBtn')?.addEventListener('click', resetDemoData);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.action;
    if (action === 'edit') {
      openModalForEdit(target.dataset.id);
    }
    if (action === 'delete') {
      deleteTransaction(target.dataset.id);
    }
  });

  document.getElementById('transactionModal')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
}

function initializePage() {
  initializeStorageAndData();
  initializeMonthSelector();
  initializeCategoryOptions();
  bindEvents();
  updateCategoryFieldBasedOnType();
  renderTable();
  updateSummary();
  updateCharts();

  const today = isoDate(new Date());
  const txnDate = document.getElementById('txnDate');
  if (txnDate && !txnDate.value) txnDate.value = today;
}

window.addEventListener('DOMContentLoaded', initializePage);
