const TIMEZONE = 'Asia/Jakarta';
const PERIOD_KEYS = Object.freeze(['month', 'quarter', 'year', 'all']);
const TYPE_KEYS = Object.freeze(['operasi', 'investasi', 'pendanaan']);
const DIRECTION_KEYS = Object.freeze(['masuk', 'keluar']);
const TYPE_LABELS = Object.freeze({
  operasi: 'Operasional',
  investasi: 'Investasi',
  pendanaan: 'Pendanaan',
});
const DIRECTION_LABELS = Object.freeze({
  masuk: 'Pemasukan',
  keluar: 'Pengeluaran',
});
const MONTHS_SHORT = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]);
const MONTHS_LONG = Object.freeze([
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]);
const MAX_CATEGORY_LENGTH = 120;
const MAX_SAFE_TOTAL = Number.MAX_SAFE_INTEGER;

const numberFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

function asDate(value, fallback) {
  let date;
  try {
    date = value === undefined
      ? new Date(fallback.getTime())
      : value instanceof Date ? new Date(value.getTime()) : new Date(value);
  } catch {
    throw new TypeError('now harus berupa tanggal yang valid.');
  }
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('now harus berupa tanggal yang valid.');
  }
  return date;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKey(year, month, day) {
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function validDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return dateKey(year, month, day);
}

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
  };
}

function zonedDateKey(date) {
  const { year, month, day } = zonedParts(date);
  return dateKey(year, month, day);
}

function instantFromValue(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const dateOnly = validDateOnly(value);
    if (dateOnly) return new Date(`${dateOnly}T00:00:00.000+07:00`);

    // Timestamp tanpa offset dianggap waktu lokal Jakarta agar hasil tidak bergantung
    // pada timezone mesin yang menjalankan service.
    const localTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(value);
    const normalized = localTimestamp ? `${value}+07:00` : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  try {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function calendarDate(value) {
  if (typeof value === 'string') {
    const only = validDateOnly(value);
    if (only) return { key: only, instant: null };
  }
  const instant = instantFromValue(value);
  return instant ? { key: zonedDateKey(instant), instant } : null;
}

function scalarQueryValue(value) {
  if (Array.isArray(value)) return scalarQueryValue(value[0]);
  return ['string', 'number'].includes(typeof value) ? String(value) : '';
}

function selectedPeriod(query) {
  const safeQuery = query && typeof query === 'object' ? query : {};
  const requested = scalarQueryValue(safeQuery.period).trim().toLowerCase();
  return PERIOD_KEYS.includes(requested) ? requested : 'month';
}

function safeText(value) {
  try {
    return value == null ? '' : String(value);
  } catch {
    return '';
  }
}

function safeId(value) {
  const id = safeText(value).trim();
  return id || null;
}

function amountOf(transaction) {
  const value = transaction && (transaction.nominal ?? transaction.amount);
  if (value == null || value === '') return null;
  let amount;
  try {
    amount = Number(value);
  } catch {
    return null;
  }
  return Number.isFinite(amount) && amount > 0 && amount <= MAX_SAFE_TOTAL ? amount : null;
}

function allowlistedValue(value, allowlist) {
  const normalized = safeText(value).trim().toLowerCase();
  return allowlist.includes(normalized) ? normalized : null;
}

function safeAdd(left, right) {
  const result = left + right;
  return Number.isFinite(result) && result <= MAX_SAFE_TOTAL ? result : MAX_SAFE_TOTAL;
}

function safeSubtract(left, right) {
  const result = left - right;
  if (Number.isFinite(result)) return result;
  return result < 0 ? -MAX_SAFE_TOTAL : MAX_SAFE_TOTAL;
}

function normalizeCategory(value) {
  const category = safeText(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CATEGORY_LENGTH);
  return category || 'Tanpa kategori';
}

function normalizeUsers(users, now) {
  const seen = new Set();
  const result = [];
  for (const user of Array.isArray(users) ? users : []) {
    if (!user || typeof user !== 'object') continue;
    const id = safeId(user.id);
    const joinedAt = instantFromValue(user.createdAt ?? user.created_at);
    if (!id || seen.has(id) || !joinedAt || joinedAt > now) continue;
    seen.add(id);
    result.push({
      id,
      joinedAt,
      joinedDate: zonedDateKey(joinedAt),
      onboardingDone: (user.onboardingDone ?? user.onboarding_done) === true,
    });
  }
  return result;
}

function normalizeTransactions(transactions, knownUsers, now, today) {
  const result = [];
  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    if (!transaction || typeof transaction !== 'object' || transaction.sample === true) continue;
    const userId = safeId(transaction.userId ?? transaction.user_id);
    const transactionDate = calendarDate(transaction.tanggal ?? transaction.date);
    const amount = amountOf(transaction);
    const type = allowlistedValue(transaction.tipe ?? transaction.type, TYPE_KEYS);
    const direction = allowlistedValue(transaction.arah ?? transaction.direction, DIRECTION_KEYS);
    if (!userId || !knownUsers.has(userId) || !transactionDate || amount == null || !type || !direction) {
      continue;
    }
    if (transactionDate.key > today || (transactionDate.instant && transactionDate.instant > now)) continue;
    result.push({
      date: transactionDate.key,
      userId,
      amount,
      type,
      direction,
      category: normalizeCategory(transaction.kategori ?? transaction.category),
    });
  }
  return result;
}

function nextDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  if (day < daysInMonth(year, month)) return dateKey(year, month, day + 1);
  if (month < 12) return dateKey(year, month + 1, 1);
  return dateKey(year + 1, 1, 1);
}

function nextMonth(key) {
  const [year, month] = key.split('-').map(Number);
  return month < 12 ? `${year}-${pad(month + 1)}` : `${year + 1}-01`;
}

function periodLabel(key, year, month) {
  if (key === 'month') return `${MONTHS_LONG[month - 1]} ${year}`;
  if (key === 'quarter') return `Kuartal ${Math.floor((month - 1) / 3) + 1} ${year}`;
  if (key === 'year') return `Tahun ${year}`;
  return 'Semua waktu';
}

function buildPeriod(key, today, earliestDate) {
  const [year, month] = today.split('-').map(Number);
  let start;
  let granularity;
  if (key === 'month') {
    start = dateKey(year, month, 1);
    granularity = 'day';
  } else if (key === 'quarter') {
    const startMonth = (Math.floor((month - 1) / 3) * 3) + 1;
    start = dateKey(year, startMonth, 1);
    granularity = 'day';
  } else if (key === 'year') {
    start = dateKey(year, 1, 1);
    granularity = 'month';
  } else {
    start = earliestDate && earliestDate <= today ? earliestDate : today;
    granularity = 'month';
  }
  return {
    key,
    label: periodLabel(key, year, month),
    start,
    end: today,
    timezone: TIMEZONE,
    granularity,
  };
}

function formatNumber(value) {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatInteger(value) {
  return integerFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatCurrency(value) {
  return `Rp ${formatNumber(value)}`;
}

function formatCount(value, singular = 'transaksi') {
  return `${formatInteger(value)} ${singular}`;
}

function emptyTotals() {
  return { inflow: 0, outflow: 0, volume: 0, count: 0 };
}

function addToTotals(totals, transaction) {
  totals.count = safeAdd(totals.count, 1);
  totals.volume = safeAdd(totals.volume, transaction.amount);
  totals[transaction.direction === 'masuk' ? 'inflow' : 'outflow'] = safeAdd(
    totals[transaction.direction === 'masuk' ? 'inflow' : 'outflow'],
    transaction.amount,
  );
}

function trendLabel(key, granularity, includeYear) {
  const [year, month, day] = key.split('-').map(Number);
  if (granularity === 'day') return `${day} ${MONTHS_SHORT[month - 1]}`;
  return `${MONTHS_SHORT[month - 1]}${includeYear ? ` ${year}` : ''}`;
}

function trendBuckets(period, transactions) {
  const totals = new Map();
  if (period.granularity === 'day') {
    for (let key = period.start; key <= period.end; key = nextDate(key)) totals.set(key, emptyTotals());
  } else {
    const endMonth = period.end.slice(0, 7);
    for (let key = period.start.slice(0, 7); key <= endMonth; key = nextMonth(key)) {
      totals.set(key, emptyTotals());
    }
  }

  for (const transaction of transactions) {
    const key = period.granularity === 'day' ? transaction.date : transaction.date.slice(0, 7);
    const bucket = totals.get(key);
    if (bucket) addToTotals(bucket, transaction);
  }

  const includeYear = period.key === 'all';
  return [...totals.entries()].map(([key, total]) => ({
    key,
    label: trendLabel(key, period.granularity, includeYear),
    inflow: total.inflow,
    inflowLabel: formatCurrency(total.inflow),
    outflow: total.outflow,
    outflowLabel: formatCurrency(total.outflow),
    volume: total.volume,
    volumeLabel: formatCurrency(total.volume),
    count: total.count,
    countLabel: formatCount(total.count),
  }));
}

function distributionPercentages(values) {
  const total = values.reduce((sum, value) => safeAdd(sum, value), 0);
  if (!total) return values.map(() => 0);

  // Largest-remainder at one decimal place keeps the displayed composition at exactly 100%.
  const rawTenths = values.map((value) => (value / total) * 1_000);
  const tenths = rawTenths.map(Math.floor);
  let remainder = 1_000 - tenths.reduce((sum, value) => sum + value, 0);
  const order = rawTenths.map((value, index) => ({
    index,
    fraction: value - tenths[index],
  })).sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < remainder; index += 1) tenths[order[index % order.length].index] += 1;
  return tenths.map((value) => value / 10);
}

function buildCashFlow(transactions) {
  const grouped = new Map(TYPE_KEYS.map((key) => [key, emptyTotals()]));
  for (const transaction of transactions) addToTotals(grouped.get(transaction.type), transaction);
  return TYPE_KEYS.map((key) => {
    const total = grouped.get(key);
    const net = safeSubtract(total.inflow, total.outflow);
    return {
      key,
      label: TYPE_LABELS[key],
      inflow: total.inflow,
      inflowLabel: formatCurrency(total.inflow),
      outflow: total.outflow,
      outflowLabel: formatCurrency(total.outflow),
      net,
      netLabel: formatCurrency(net),
      count: total.count,
      countLabel: formatCount(total.count),
    };
  });
}

function compositionRows(keys, labels, transactions, selector) {
  const totals = new Map(keys.map((key) => [key, { count: 0, volume: 0 }]));
  for (const transaction of transactions) {
    const row = totals.get(selector(transaction));
    row.count = safeAdd(row.count, 1);
    row.volume = safeAdd(row.volume, transaction.amount);
  }
  const percentages = distributionPercentages(keys.map((key) => totals.get(key).volume));
  return keys.map((key, index) => ({
    key,
    label: labels[key],
    count: totals.get(key).count,
    countLabel: formatCount(totals.get(key).count),
    percentage: percentages[index],
    percentageLabel: `${formatNumber(percentages[index])}%`,
    volume: totals.get(key).volume,
    volumeLabel: formatCurrency(totals.get(key).volume),
  }));
}

function buildTypes(transactions) {
  return {
    byType: compositionRows(TYPE_KEYS, TYPE_LABELS, transactions, (transaction) => transaction.type),
    byDirection: compositionRows(
      DIRECTION_KEYS,
      DIRECTION_LABELS,
      transactions,
      (transaction) => transaction.direction,
    ),
  };
}

function buildCategories(transactions) {
  const grouped = new Map();
  for (const transaction of transactions) {
    const normalizedKey = transaction.category.toLocaleLowerCase('id-ID');
    const row = grouped.get(normalizedKey) || {
      name: transaction.category,
      count: 0,
      volume: 0,
    };
    row.count = safeAdd(row.count, 1);
    row.volume = safeAdd(row.volume, transaction.amount);
    grouped.set(normalizedKey, row);
  }
  const ranked = [...grouped.values()].sort((left, right) => (
    right.volume - left.volume
    || right.count - left.count
    || left.name.localeCompare(right.name, 'id-ID')
  )).slice(0, 8);
  const totalVolume = transactions.reduce((sum, transaction) => safeAdd(sum, transaction.amount), 0);
  const remainingVolume = Math.max(0, safeSubtract(
    totalVolume,
    ranked.reduce((sum, row) => safeAdd(sum, row.volume), 0),
  ));
  const percentages = distributionPercentages([
    ...ranked.map((row) => row.volume),
    remainingVolume,
  ]);
  return ranked.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    count: row.count,
    countLabel: formatCount(row.count),
    volume: row.volume,
    volumeLabel: formatCurrency(row.volume),
    percentage: percentages[index],
    percentageLabel: `${formatNumber(percentages[index])}%`,
  }));
}

function rate(part, total) {
  if (!total) return 0;
  const result = (part / total) * 100;
  return Number.isFinite(result) ? Math.round(result * 10) / 10 : 0;
}

function buildUserActivity(users, transactions, period) {
  const activeUsers = new Set(transactions.map((transaction) => transaction.userId)).size;
  const newUsers = users.filter((user) => (
    user.joinedDate >= period.start && user.joinedDate <= period.end
  )).length;
  const onboardingCompleted = users.filter((user) => user.onboardingDone).length;
  const activeRate = rate(activeUsers, users.length);
  const onboardingRate = rate(onboardingCompleted, users.length);
  return {
    totalUsers: users.length,
    totalUsersLabel: formatCount(users.length, 'pengguna'),
    activeUsers,
    activeUsersLabel: formatCount(activeUsers, 'pengguna'),
    newUsers,
    newUsersLabel: formatCount(newUsers, 'pengguna baru'),
    onboardingCompleted,
    onboardingCompletedLabel: formatCount(onboardingCompleted, 'pengguna'),
    activeRate,
    activeRateLabel: `${formatNumber(activeRate)}%`,
    onboardingRate,
    onboardingRateLabel: `${formatNumber(onboardingRate)}%`,
  };
}

function buildSummary(transactions) {
  const totals = emptyTotals();
  const activeUserIds = new Set();
  for (const transaction of transactions) {
    addToTotals(totals, transaction);
    activeUserIds.add(transaction.userId);
  }
  const netFlow = safeSubtract(totals.inflow, totals.outflow);
  return {
    transactionCount: totals.count,
    transactionCountLabel: formatCount(totals.count),
    totalVolume: totals.volume,
    totalVolumeLabel: formatCurrency(totals.volume),
    inflow: totals.inflow,
    inflowLabel: formatCurrency(totals.inflow),
    outflow: totals.outflow,
    outflowLabel: formatCurrency(totals.outflow),
    netFlow,
    netFlowLabel: formatCurrency(netFlow),
    activeUsers: activeUserIds.size,
    activeUsersLabel: formatCount(activeUserIds.size, 'pengguna'),
  };
}

/**
 * Builds a read-only, allowlisted report from rows already loaded from PostgreSQL.
 * No user identity, transaction description, credential, or source row is returned.
 */
function buildAdminReport(users, transactions, query = {}, nowValue) {
  const now = asDate(nowValue, new Date());
  const today = zonedDateKey(now);
  const normalizedUsers = normalizeUsers(users, now);
  const normalizedTransactions = normalizeTransactions(
    transactions,
    new Set(normalizedUsers.map((user) => user.id)),
    now,
    today,
  );
  const earliestDate = [
    ...normalizedUsers.map((user) => user.joinedDate),
    ...normalizedTransactions.map((transaction) => transaction.date),
  ].sort()[0];
  const period = buildPeriod(selectedPeriod(query), today, earliestDate);
  const periodTransactions = normalizedTransactions.filter((transaction) => (
    transaction.date >= period.start && transaction.date <= period.end
  ));

  return {
    period,
    summary: buildSummary(periodTransactions),
    trend: trendBuckets(period, periodTransactions),
    cashFlow: buildCashFlow(periodTransactions),
    types: buildTypes(periodTransactions),
    categories: buildCategories(periodTransactions),
    userActivity: buildUserActivity(normalizedUsers, periodTransactions, period),
  };
}

module.exports = { buildAdminReport };
