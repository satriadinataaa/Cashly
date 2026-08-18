const TIMEZONE = 'Asia/Jakarta';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const integerFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function asDate(value, fallback) {
  const date = value === undefined ? fallback : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('now harus berupa tanggal yang valid.');
  }
  return date;
}

function zonedDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function validDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').slice(0, 10));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function instantDateKey(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return validDateKey(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : zonedDateKey(date);
}

function transactionDateKey(transaction) {
  return validDateKey(transaction && (transaction.tanggal || transaction.date));
}

function shiftMonth(year, month, offset) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function monthStart(year, month) {
  return `${year}-${pad(month)}-01`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildPeriod(now) {
  const today = zonedDateKey(now);
  const [year, month, day] = today.split('-').map(Number);
  const previous = shiftMonth(year, month, -1);
  const previousDay = Math.min(day, daysInMonth(previous.year, previous.month));
  return {
    start: monthStart(year, month),
    end: today,
    previousStart: monthStart(previous.year, previous.month),
    previousEnd: `${previous.year}-${pad(previous.month)}-${pad(previousDay)}`,
    label: `01\u2013${pad(day)} ${MONTHS_LONG[month - 1]} ${year}`,
    timezone: TIMEZONE,
  };
}

function uniqueUsers(users) {
  const seen = new Set();
  return (Array.isArray(users) ? users : []).filter((user, index) => {
    if (!user || typeof user !== 'object') return false;
    const key = user.id == null || user.id === '' ? `__index_${index}` : String(user.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function realTransactions(transactions) {
  return (Array.isArray(transactions) ? transactions : [])
    .filter((transaction) => transaction && typeof transaction === 'object' && transaction.sample !== true)
    .map((transaction) => ({ transaction, date: transactionDateKey(transaction) }))
    .filter((entry) => entry.date);
}

function inRange(entry, start, end) {
  return entry.date >= start && entry.date <= end;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function userIdOf(transaction) {
  const value = transaction && (transaction.userId ?? transaction.user_id);
  return value == null || value === '' ? null : String(value);
}

function formatInteger(value) {
  return integerFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatCurrency(value) {
  const amount = Number.isFinite(value) ? value : 0;
  const absolute = Math.abs(amount);
  const compact = [
    [1_000_000_000_000, 'T'],
    [1_000_000_000, 'M'],
    [1_000_000, 'Jt'],
    [1_000, 'Rb'],
  ].find(([threshold]) => absolute >= threshold);
  if (!compact) return `Rp ${formatInteger(amount)}`;
  return `Rp ${decimalFormatter.format(amount / compact[0])} ${compact[1]}`;
}

function formatTrend(current, previous) {
  if (!previous) return current ? '+100%' : '0%';
  const percentage = ((current - previous) / previous) * 100;
  if (Math.abs(percentage) < 0.05) return '0%';
  return `${percentage > 0 ? '+' : ''}${decimalFormatter.format(percentage)}%`;
}

function uniqueActiveUsers(entries) {
  const ids = new Set();
  for (const { transaction } of entries) {
    const id = userIdOf(transaction);
    if (id) ids.add(id);
  }
  return ids;
}

function monthSeries(users, entries, period) {
  const [year, month] = period.end.split('-').map(Number);
  const months = Array.from({ length: 7 }, (_, index) => shiftMonth(year, month, index - 6));
  return {
    labels: months.map(({ month: itemMonth }) => MONTHS_SHORT[itemMonth - 1]),
    active: months.map(({ year: itemYear, month: itemMonth }) => {
      const prefix = `${itemYear}-${pad(itemMonth)}`;
      return uniqueActiveUsers(entries.filter((entry) => entry.date.startsWith(prefix))).size;
    }),
    newUsers: months.map(({ year: itemYear, month: itemMonth }) => {
      const prefix = `${itemYear}-${pad(itemMonth)}`;
      return users.filter((user) => instantDateKey(user.createdAt ?? user.created_at)?.startsWith(prefix)).length;
    }),
  };
}

function transactionKind(transaction) {
  const explicitKind = String(transaction.jenis || '').toLowerCase();
  if (explicitKind) return explicitKind;
  if (transaction.tipe === 'investasi') return 'investment';
  if (transaction.tipe === 'pendanaan') return 'financing';
  return transaction.arah === 'masuk' ? 'income' : 'expense';
}

function roundedPercentages(counts) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((count) => (count / total) * 100);
  const result = raw.map(Math.floor);
  let remainder = 100 - result.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - result[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < remainder; index += 1) result[order[index].index] += 1;
  return result;
}

function cashFlowHealth(entries) {
  const flows = new Map();
  for (const { transaction } of entries) {
    const userId = userIdOf(transaction);
    if (!userId) continue;
    if (!flows.has(userId)) flows.set(userId, { inflow: 0, outflow: 0 });
    const kind = transactionKind(transaction);
    if (kind === 'transfer' || kind === 'saving') continue;
    const amount = numberValue(transaction.nominal ?? transaction.amount);
    if (transaction.arah === 'masuk') flows.get(userId).inflow += amount;
    else if (transaction.arah === 'keluar') flows.get(userId).outflow += amount;
  }

  const counts = [0, 0, 0];
  for (const flow of flows.values()) {
    if (!flow.inflow) counts[flow.outflow ? 2 : 1] += 1;
    else {
      const savingsRate = (flow.inflow - flow.outflow) / flow.inflow;
      counts[savingsRate >= 0.2 ? 0 : savingsRate >= 0 ? 1 : 2] += 1;
    }
  }
  const percentages = roundedPercentages(counts);
  return [
    { label: 'Sehat', value: percentages[0], count: formatInteger(counts[0]), color: '#287557' },
    { label: 'Perlu perhatian', value: percentages[1], count: formatInteger(counts[1]), color: '#e6ad52' },
    { label: 'Berisiko', value: percentages[2], count: formatInteger(counts[2]), color: '#dc7668' },
  ];
}

function categoryAppearance(name, index) {
  const normalized = name.toLocaleLowerCase('id-ID');
  const matches = [
    [/makan|minum|kuliner|restoran|grocer|sembako/, 'food', '#2f8060'],
    [/transport|bensin|kendaraan|parkir|ojek|taksi/, 'car', '#638bb1'],
    [/belanja|shopping|pakaian|fashion/, 'bag', '#8c7bbb'],
    [/tagihan|utilitas|listrik|internet|telepon|air/, 'bolt', '#d49b44'],
  ];
  const match = matches.find(([pattern]) => pattern.test(normalized));
  if (match) return { icon: match[1], color: match[2] };
  const fallbacks = [
    { icon: 'receipt', color: '#2f8060' },
    { icon: 'wallet', color: '#638bb1' },
    { icon: 'bag', color: '#8c7bbb' },
    { icon: 'grid', color: '#d49b44' },
  ];
  return fallbacks[index % fallbacks.length];
}

function topCategories(entries) {
  const totals = new Map();
  for (const { transaction } of entries) {
    if (transactionKind(transaction) !== 'expense') continue;
    const amount = numberValue(transaction.nominal ?? transaction.amount);
    if (!amount) continue;
    const name = String(transaction.kategori ?? transaction.category ?? '').trim() || 'Tanpa kategori';
    const current = totals.get(name) || { name, amount: 0, count: 0 };
    current.amount += amount;
    current.count += 1;
    totals.set(name, current);
  }
  const ranked = [...totals.values()].sort((left, right) => right.amount - left.amount
    || right.count - left.count || left.name.localeCompare(right.name, 'id-ID'));
  const totalAmount = ranked.reduce((sum, category) => sum + category.amount, 0);
  return ranked.slice(0, 4).map((category, index) => ({
    name: category.name,
    ...categoryAppearance(category.name, index),
    amount: formatCurrency(category.amount),
    count: `${formatInteger(category.count)} transaksi`,
    percent: totalAmount ? Math.round((category.amount / totalAmount) * 100) : 0,
  }));
}

function activityInstant(transaction) {
  const created = transaction.createdAt ?? transaction.created_at;
  if (created != null && created !== '') {
    const parsed = new Date(created);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const date = transactionDateKey(transaction);
  return date ? new Date(`${date}T00:00:00.000+07:00`) : null;
}

function relativeTime(date, now) {
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'baru saja';
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} jam lalu`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)} hari lalu`;
  const key = zonedDateKey(date);
  const [year, month, day] = key.split('-').map(Number);
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

function recentActivities(users, transactions, now) {
  const names = new Map(users.filter((user) => user.id != null)
    .map((user) => [String(user.id), String(user.name || '').trim() || 'Pengguna']));
  const items = [];

  users.forEach((user, index) => {
    const value = user.createdAt ?? user.created_at;
    if (value == null || value === '') return;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date > now) return;
    const name = String(user.name || '').trim() || 'Pengguna baru';
    items.push({
      date,
      order: index,
      icon: 'userPlus',
      tone: 'green',
      title: 'Pengguna baru terdaftar',
      text: `${name} bergabung dengan Cashly`,
    });
  });

  transactions.forEach((transaction, index) => {
    if (!transaction || typeof transaction !== 'object' || transaction.sample === true) return;
    const date = activityInstant(transaction);
    if (!date || date > now) return;
    const incoming = transaction.arah === 'masuk';
    const category = String(transaction.kategori ?? transaction.category ?? '').trim() || 'transaksi';
    const owner = names.get(userIdOf(transaction)) || 'Pengguna';
    items.push({
      date,
      order: users.length + index,
      icon: incoming ? 'wallet' : 'receipt',
      tone: incoming ? 'green' : 'orange',
      title: incoming ? 'Pemasukan baru tercatat' : 'Pengeluaran baru tercatat',
      text: `${owner} mencatat ${category} senilai ${formatCurrency(numberValue(transaction.nominal ?? transaction.amount))}`,
    });
  });

  return items.sort((left, right) => right.date - left.date || right.order - left.order)
    .slice(0, 4)
    .map(({ date, order, ...item }) => ({ ...item, time: relativeTime(date, now) }));
}

function buildAdminInsights(users, transactions, nowValue) {
  const now = asDate(nowValue, new Date());
  const period = buildPeriod(now);
  const normalizedUsers = uniqueUsers(users);
  const normalizedTransactions = realTransactions(transactions);
  const currentEntries = normalizedTransactions.filter((entry) => inRange(entry, period.start, period.end));
  const previousEntries = normalizedTransactions.filter((entry) => inRange(entry, period.previousStart, period.previousEnd));

  const currentUsers = normalizedUsers.filter((user) => {
    const created = instantDateKey(user.createdAt ?? user.created_at);
    return !created || created <= period.end;
  });
  const usersBeforeMonth = currentUsers.filter((user) => {
    const created = instantDateKey(user.createdAt ?? user.created_at);
    return !created || created < period.start;
  });
  const currentActive = uniqueActiveUsers(currentEntries).size;
  const previousActive = uniqueActiveUsers(previousEntries).size;
  const currentVolume = currentEntries.reduce(
    (sum, { transaction }) => sum + numberValue(transaction.nominal ?? transaction.amount), 0,
  );
  const previousVolume = previousEntries.reduce(
    (sum, { transaction }) => sum + numberValue(transaction.nominal ?? transaction.amount), 0,
  );
  const activeShare = currentUsers.length ? (currentActive / currentUsers.length) * 100 : 0;

  return {
    metrics: [
      {
        label: 'Total pengguna', value: formatInteger(currentUsers.length),
        trend: formatTrend(currentUsers.length, usersBeforeMonth.length),
        note: 'vs. bulan lalu', icon: 'users', tone: 'green',
      },
      {
        label: 'Pengguna aktif', value: formatInteger(currentActive),
        trend: formatTrend(currentActive, previousActive),
        note: `${decimalFormatter.format(activeShare)}% dari total`, icon: 'pulse', tone: 'blue',
      },
      {
        label: 'Total transaksi', value: formatInteger(currentEntries.length),
        trend: formatTrend(currentEntries.length, previousEntries.length),
        note: 'bulan ini', icon: 'receipt', tone: 'purple',
      },
      {
        label: 'Volume transaksi', value: formatCurrency(currentVolume),
        trend: formatTrend(currentVolume, previousVolume),
        note: 'bulan ini', icon: 'wallet', tone: 'orange',
      },
    ],
    growth: monthSeries(normalizedUsers, normalizedTransactions, period),
    health: cashFlowHealth(currentEntries),
    categories: topCategories(currentEntries),
    activities: recentActivities(currentUsers, Array.isArray(transactions) ? transactions : [], now),
    period,
  };
}

module.exports = { buildAdminInsights };
