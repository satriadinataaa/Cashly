const { summarize, transactionKind } = require('../../src/accounting');
const { TYPES, TYPE_LABELS } = require('../constants');
const { isIsoDate } = require('../validation');

function zonedDate(now = new Date(), timezone = 'Asia/Jakarta') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function resolvePeriod(query = {}, now = new Date()) {
  const timezone = String(query.timezone || process.env.APP_TIMEZONE || 'Asia/Jakarta');
  try { new Intl.DateTimeFormat('id-ID', { timeZone: timezone }).format(now); }
  catch { throw new Error('Timezone tidak valid.'); }
  if (query.start || query.end) {
    if (query.start && !isIsoDate(query.start)) throw new Error('start harus berupa tanggal YYYY-MM-DD yang valid.');
    if (query.end && !isIsoDate(query.end)) throw new Error('end harus berupa tanggal YYYY-MM-DD yang valid.');
    if (query.start && query.end && query.start > query.end) throw new Error('start tidak boleh setelah end.');
    return { preset: 'custom', start: query.start, end: query.end, timezone };
  }
  const preset = query.period || 'month';
  if (!['today', 'week', 'month', 'all'].includes(preset)) throw new Error('Period tidak valid.');
  const today = zonedDate(now, timezone);
  if (preset === 'all') return { preset, timezone };
  if (preset === 'today') return { preset, start: today, end: today, timezone };
  if (preset === 'month') return { preset, start: `${today.slice(0, 7)}-01`, end: today, timezone };
  const date = new Date(`${today}T12:00:00Z`);
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return { preset, start: date.toISOString().slice(0, 10), end: today, timezone };
}

function inPeriod(rows, period) {
  return rows.filter((row) => (!period.start || row.tanggal >= period.start)
    && (!period.end || row.tanggal <= period.end));
}

function calculateStreak(rows) {
  const days = [...new Set(rows.map((row) => row.tanggal))].sort().reverse();
  if (!days.length) return { days: 0, lastLoggedDate: null };
  let count = 1;
  for (let index = 1; index < days.length; index += 1) {
    const newer = new Date(`${days[index - 1]}T12:00:00Z`);
    const older = new Date(`${days[index]}T12:00:00Z`);
    if ((newer - older) / 86400000 !== 1) break;
    count += 1;
  }
  return { days: count, lastLoggedDate: days[0] };
}

function trendFor(periodRows, lifetimeRows, period) {
  const openingRows = period.start ? lifetimeRows.filter((row) => row.tanggal < period.start) : [];
  let balance = summarize(openingRows).cashBalance;
  const byDate = new Map();
  for (const row of [...periodRows].sort((a, b) => a.tanggal.localeCompare(b.tanggal))) {
    const kind = transactionKind(row);
    const change = ['transfer', 'saving'].includes(kind) ? 0 : (row.arah === 'masuk' ? row.nominal : -row.nominal);
    byDate.set(row.tanggal, (byDate.get(row.tanggal) || 0) + change);
  }
  return [...byDate].map(([date, netChange]) => {
    balance += netChange;
    return { date, netChange, balance };
  });
}

function expenseBreakdown(rows) {
  const expenses = rows.filter((row) => transactionKind(row) === 'expense');
  const total = expenses.reduce((sum, row) => sum + row.nominal, 0);
  const percentage = (amount) => total ? Math.round((amount / total) * 100) : 0;
  const byType = TYPES.map((type) => {
    const amount = expenses.filter((row) => row.tipe === type).reduce((sum, row) => sum + row.nominal, 0);
    return { type, label: TYPE_LABELS[type], amount, percentage: percentage(amount) };
  });
  const categoryMap = new Map();
  for (const row of expenses) categoryMap.set(row.kategori, (categoryMap.get(row.kategori) || 0) + row.nominal);
  const byCategory = [...categoryMap].map(([category, amount]) => ({ category, amount, percentage: percentage(amount) }))
    .sort((a, b) => b.amount - a.amount);
  return { total, byType, byCategory };
}

function structuredInsights(flow, expenses) {
  const savingsRate = flow.income ? Math.round(((flow.income - flow.expense - flow.investment) / flow.income) * 100) : null;
  return {
    cashFlow: savingsRate === null ? null : {
      status: savingsRate >= 20 ? 'healthy' : savingsRate >= 0 ? 'positive' : 'negative',
      savingsRate,
    },
    topExpenseCategory: expenses.byCategory[0] || null,
    topExpenseType: [...expenses.byType].sort((a, b) => b.amount - a.amount)[0] || null,
  };
}

function buildDashboard(lifetimeRows, period) {
  const rows = inPeriod(lifetimeRows, period);
  const lifetime = summarize(lifetimeRows);
  const periodSummary = summarize(rows);
  const flow = {
    inflow: periodSummary.cashInflow,
    outflow: periodSummary.cashOutflow,
    net: periodSummary.cashInflow - periodSummary.cashOutflow,
    income: periodSummary.income,
    expense: periodSummary.expense,
    investment: periodSummary.investment,
  };
  const expenses = expenseBreakdown(rows);
  return {
    period,
    lifetime: {
      cashBalance: lifetime.cashBalance,
      assetBookValue: lifetime.assetBookValue,
      totalAssets: lifetime.totalAssets,
      totalLiabilities: lifetime.totalLiabilities,
      netWorth: lifetime.netWorth,
    },
    flow,
    counts: {
      income: rows.filter((row) => transactionKind(row) === 'income').length,
      expense: rows.filter((row) => transactionKind(row) === 'expense').length,
      total: rows.length,
    },
    streak: calculateStreak(lifetimeRows),
    recent: rows.slice(0, 5),
    trend: trendFor(rows, lifetimeRows, period),
    expenses,
    insights: structuredInsights(flow, expenses),
  };
}

function buildCashFlowReport(lifetimeRows, period) {
  const rows = inPeriod(lifetimeRows, period);
  const activities = TYPES.map((type) => {
    const summary = summarize(rows.filter((row) => row.tipe === type));
    return {
      type, label: TYPE_LABELS[type], inflow: summary.cashInflow,
      outflow: summary.cashOutflow, net: summary.cashInflow - summary.cashOutflow,
    };
  });
  return {
    period,
    activities,
    totals: activities.reduce((totals, activity) => ({
      inflow: totals.inflow + activity.inflow,
      outflow: totals.outflow + activity.outflow,
      net: totals.net + activity.net,
    }), { inflow: 0, outflow: 0, net: 0 }),
  };
}

module.exports = {
  zonedDate, resolvePeriod, inPeriod, calculateStreak, expenseBreakdown,
  buildDashboard, buildCashFlowReport,
};
