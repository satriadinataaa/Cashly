const TIMEZONE = 'Asia/Jakarta';
const ADMIN_INSIGHT_KEYS = Object.freeze([
  'total-users',
  'active-users',
  'total-transactions',
  'transaction-volume',
]);
const DEFAULT_DETAIL_LIMIT = 10;
const MAX_DETAIL_LIMIT = 50;
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
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
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

function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date).replace(/\./g, '');
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
        key: 'total-users',
        label: 'Total pengguna', value: formatInteger(currentUsers.length),
        trend: formatTrend(currentUsers.length, usersBeforeMonth.length),
        note: 'vs. bulan lalu', icon: 'users', tone: 'green',
      },
      {
        key: 'active-users',
        label: 'Pengguna aktif', value: formatInteger(currentActive),
        trend: formatTrend(currentActive, previousActive),
        note: `${decimalFormatter.format(activeShare)}% dari total`, icon: 'pulse', tone: 'blue',
      },
      {
        key: 'total-transactions',
        label: 'Total transaksi', value: formatInteger(currentEntries.length),
        trend: formatTrend(currentEntries.length, previousEntries.length),
        note: 'bulan ini', icon: 'receipt', tone: 'purple',
      },
      {
        key: 'transaction-volume',
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

function scalarQueryValue(value) {
  if (Array.isArray(value)) return scalarQueryValue(value[0]);
  return ['string', 'number'].includes(typeof value) ? String(value) : '';
}

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const text = scalarQueryValue(value).trim();
  if (!/^\d+$/.test(text)) return fallback;
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function paginate(items, query) {
  const safeQuery = query && typeof query === 'object' ? query : {};
  const requestedPage = positiveInteger(safeQuery.page, 1);
  const limit = positiveInteger(safeQuery.limit, DEFAULT_DETAIL_LIMIT, MAX_DETAIL_LIMIT);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const page = Math.min(requestedPage, totalPages);
  const start = Math.min((page - 1) * limit, Number.MAX_SAFE_INTEGER);
  return {
    items: items.slice(start, start + limit),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}

function safeSum(values) {
  let total = 0;
  for (const value of values) {
    const next = total + numberValue(value);
    total = Number.isFinite(next) ? next : Number.MAX_VALUE;
  }
  return total;
}

function percentage(part, total) {
  if (!total) return 0;
  const value = (part / total) * 100;
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
}

function userCreatedInstant(user) {
  const value = user && (user.createdAt ?? user.created_at);
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function transactionType(transaction) {
  return String(transaction && (transaction.tipe ?? transaction.type) || '').trim().toLowerCase() || 'lainnya';
}

function typeLabel(value) {
  const labels = { operasi: 'Operasional', investasi: 'Investasi', pendanaan: 'Pendanaan' };
  return labels[value] || `${value.charAt(0).toLocaleUpperCase('id-ID')}${value.slice(1)}`;
}

function directionValue(transaction) {
  const direction = String(transaction && (transaction.arah ?? transaction.direction) || '').trim().toLowerCase();
  return direction === 'masuk' || direction === 'keluar' ? direction : 'lainnya';
}

function directionLabel(value) {
  return { masuk: 'Pemasukan', keluar: 'Pengeluaran', lainnya: 'Lainnya' }[value];
}

function periodUserItem(user, entries) {
  const joinedAt = userCreatedInstant(user);
  const orderedEntries = [...entries].sort((left, right) => right.date.localeCompare(left.date));
  const lastActivity = orderedEntries[0]?.date || null;
  const totalVolume = safeSum(entries.map(({ transaction }) => transaction.nominal ?? transaction.amount));
  const status = entries.length ? 'active' : 'inactive';
  return {
    id: user.id ?? null,
    name: String(user.name ?? '').trim() || 'Pengguna',
    email: String(user.email ?? '').trim(),
    onboardingDone: Boolean(user.onboardingDone ?? user.onboarding_done),
    status,
    statusLabel: status === 'active' ? 'Aktif' : 'Tidak aktif',
    joinedAt: joinedAt ? joinedAt.toISOString() : null,
    joinedAtLabel: formatDate(joinedAt),
    transactionCount: entries.length,
    totalVolume,
    totalVolumeLabel: formatCurrency(totalVolume),
    lastActivity,
    lastActivityLabel: lastActivity
      ? formatDate(new Date(`${lastActivity}T00:00:00.000+07:00`))
      : 'Belum ada aktivitas pada periode ini',
  };
}

function transactionItem(entry, user) {
  const { transaction, date } = entry;
  const type = transactionType(transaction);
  const direction = directionValue(transaction);
  const amount = numberValue(transaction.nominal ?? transaction.amount);
  const category = String(transaction.kategori ?? transaction.category ?? '').trim() || 'Tanpa kategori';
  const description = String(transaction.deskripsi ?? transaction.description ?? '').trim();
  return {
    id: transaction.id ?? null,
    userId: userIdOf(transaction),
    userName: user ? String(user.name ?? '').trim() || 'Pengguna' : 'Pengguna',
    userEmail: user ? String(user.email ?? '').trim() : '',
    date,
    dateLabel: formatDate(new Date(`${date}T00:00:00.000+07:00`)),
    type,
    typeLabel: typeLabel(type),
    category,
    categoryLabel: category,
    description,
    direction,
    directionLabel: directionLabel(direction),
    amount,
    amountLabel: formatCurrency(amount),
  };
}

function breakdownBy(entries, valueOf, amountBased = false) {
  const groups = new Map();
  for (const entry of entries) {
    const key = valueOf(entry.transaction);
    const current = groups.get(key) || { key, count: 0, amount: 0 };
    current.count += 1;
    current.amount = safeSum([current.amount, entry.transaction.nominal ?? entry.transaction.amount]);
    groups.set(key, current);
  }
  const total = amountBased
    ? safeSum([...groups.values()].map((item) => item.amount))
    : [...groups.values()].reduce((sum, item) => sum + item.count, 0);
  return [...groups.values()]
    .sort((left, right) => (amountBased ? right.amount - left.amount : right.count - left.count)
      || left.key.localeCompare(right.key, 'id-ID'))
    .map((item) => {
      const value = amountBased ? item.amount : item.count;
      const label = valueOf === directionValue ? directionLabel(item.key) : typeLabel(item.key);
      return {
        key: item.key,
        label,
        value,
        valueLabel: amountBased ? formatCurrency(value) : formatInteger(value),
        count: item.count,
        percent: percentage(value, total),
      };
    });
}

function buildAdminInsightDetail(key, users, transactions, query = {}, nowValue) {
  if (!ADMIN_INSIGHT_KEYS.includes(key)) return null;

  const now = asDate(nowValue, new Date());
  const overview = buildAdminInsights(users, transactions, now);
  const period = overview.period;
  const normalizedUsers = uniqueUsers(users);
  const currentUsers = normalizedUsers.filter((user) => {
    const created = instantDateKey(user.createdAt ?? user.created_at);
    return !created || created <= period.end;
  });
  const currentEntries = realTransactions(transactions)
    .filter((entry) => inRange(entry, period.start, period.end));
  const userById = new Map(normalizedUsers
    .filter((user) => user.id != null && user.id !== '')
    .map((user) => [String(user.id), user]));
  const entriesByUser = new Map();
  for (const entry of currentEntries) {
    const userId = userIdOf(entry.transaction);
    if (!userId) continue;
    if (!entriesByUser.has(userId)) entriesByUser.set(userId, []);
    entriesByUser.get(userId).push(entry);
  }

  const currentVolume = safeSum(currentEntries
    .map(({ transaction }) => transaction.nominal ?? transaction.amount));
  const incomingEntries = currentEntries.filter(({ transaction }) => directionValue(transaction) === 'masuk');
  const outgoingEntries = currentEntries.filter(({ transaction }) => directionValue(transaction) === 'keluar');
  const incomingVolume = safeSum(incomingEntries
    .map(({ transaction }) => transaction.nominal ?? transaction.amount));
  const outgoingVolume = safeSum(outgoingEntries
    .map(({ transaction }) => transaction.nominal ?? transaction.amount));
  const activeIds = [...uniqueActiveUsers(currentEntries)];
  const metric = overview.metrics.find((item) => item.key === key);

  let title;
  let description;
  let itemType;
  let allItems;
  let highlights;
  let breakdown;

  if (key === 'total-users') {
    title = 'Detail total pengguna';
    description = 'Seluruh pengguna yang telah terdaftar hingga akhir periode laporan.';
    itemType = 'users';
    allItems = currentUsers.map((user) => periodUserItem(
      user,
      entriesByUser.get(user.id == null ? '' : String(user.id)) || [],
    )).sort((left, right) => (Date.parse(right.joinedAt) || 0) - (Date.parse(left.joinedAt) || 0)
      || left.name.localeCompare(right.name, 'id-ID')
      || String(left.id ?? '').localeCompare(String(right.id ?? ''), 'id-ID'));
    const joinedThisPeriod = currentUsers.filter((user) => {
      const created = instantDateKey(user.createdAt ?? user.created_at);
      return created && created >= period.start;
    }).length;
    const onboarded = currentUsers.filter((user) => Boolean(user.onboardingDone ?? user.onboarding_done)).length;
    highlights = [
      { label: 'Pengguna baru periode ini', value: joinedThisPeriod, valueLabel: formatInteger(joinedThisPeriod) },
      { label: 'Onboarding selesai', value: onboarded, valueLabel: formatInteger(onboarded) },
      { label: 'Tingkat penyelesaian onboarding', value: percentage(onboarded, currentUsers.length), valueLabel: `${decimalFormatter.format(percentage(onboarded, currentUsers.length))}%` },
      { label: 'Pengguna aktif periode ini', value: activeIds.length, valueLabel: formatInteger(activeIds.length) },
    ];
    const notOnboarded = currentUsers.length - onboarded;
    breakdown = [
      { key: 'completed', label: 'Onboarding selesai', value: onboarded, valueLabel: formatInteger(onboarded), count: onboarded, percent: percentage(onboarded, currentUsers.length) },
      { key: 'not-completed', label: 'Onboarding belum selesai', value: notOnboarded, valueLabel: formatInteger(notOnboarded), count: notOnboarded, percent: percentage(notOnboarded, currentUsers.length) },
    ];
  } else if (key === 'active-users') {
    title = 'Detail pengguna aktif';
    description = 'Pengguna yang mencatat transaksi nyata pada periode berjalan.';
    itemType = 'users';
    allItems = activeIds.map((id) => periodUserItem(
      userById.get(id) || { id, name: 'Pengguna', email: '' },
      entriesByUser.get(id) || [],
    )).sort((left, right) => String(right.lastActivity || '').localeCompare(String(left.lastActivity || ''))
      || right.transactionCount - left.transactionCount
      || left.name.localeCompare(right.name, 'id-ID'));
    const activeVolume = safeSum(allItems.map((item) => item.totalVolume));
    highlights = [
      { label: 'Porsi dari total pengguna', value: percentage(activeIds.length, currentUsers.length), valueLabel: `${decimalFormatter.format(percentage(activeIds.length, currentUsers.length))}%` },
      { label: 'Transaksi pengguna aktif', value: currentEntries.length, valueLabel: formatInteger(currentEntries.length) },
      { label: 'Rata-rata volume per pengguna', value: activeIds.length ? activeVolume / activeIds.length : 0, valueLabel: formatCurrency(activeIds.length ? activeVolume / activeIds.length : 0) },
      { label: 'Rata-rata transaksi per pengguna', value: activeIds.length ? currentEntries.length / activeIds.length : 0, valueLabel: decimalFormatter.format(activeIds.length ? currentEntries.length / activeIds.length : 0) },
    ];
    breakdown = breakdownBy(currentEntries, directionValue);
  } else {
    title = key === 'total-transactions' ? 'Detail total transaksi' : 'Detail volume transaksi';
    description = key === 'total-transactions'
      ? 'Seluruh transaksi nyata yang tercatat pada periode berjalan.'
      : 'Nilai akumulasi seluruh transaksi nyata pada periode berjalan.';
    itemType = 'transactions';
    allItems = currentEntries.map((entry) => transactionItem(
      entry,
      userById.get(userIdOf(entry.transaction)),
    )).sort((left, right) => right.date.localeCompare(left.date)
      || String(right.id ?? '').localeCompare(String(left.id ?? ''), 'id-ID'));
    highlights = key === 'total-transactions' ? [
      { label: 'Transaksi masuk', value: incomingEntries.length, valueLabel: formatInteger(incomingEntries.length) },
      { label: 'Transaksi keluar', value: outgoingEntries.length, valueLabel: formatInteger(outgoingEntries.length) },
      { label: 'Rata-rata nilai transaksi', value: currentEntries.length ? currentVolume / currentEntries.length : 0, valueLabel: formatCurrency(currentEntries.length ? currentVolume / currentEntries.length : 0) },
      { label: 'Pengguna aktif', value: activeIds.length, valueLabel: formatInteger(activeIds.length) },
    ] : [
      { label: 'Volume masuk', value: incomingVolume, valueLabel: formatCurrency(incomingVolume) },
      { label: 'Volume keluar', value: outgoingVolume, valueLabel: formatCurrency(outgoingVolume) },
      { label: 'Rata-rata nilai transaksi', value: currentEntries.length ? currentVolume / currentEntries.length : 0, valueLabel: formatCurrency(currentEntries.length ? currentVolume / currentEntries.length : 0) },
      { label: 'Transaksi terbesar', value: currentEntries.reduce((maximum, entry) => Math.max(maximum, numberValue(entry.transaction.nominal ?? entry.transaction.amount)), 0), valueLabel: formatCurrency(currentEntries.reduce((maximum, entry) => Math.max(maximum, numberValue(entry.transaction.nominal ?? entry.transaction.amount)), 0)) },
    ];
    breakdown = breakdownBy(currentEntries, transactionType, key === 'transaction-volume');
  }

  const paged = paginate(allItems, query);
  return {
    key,
    title,
    description,
    metric,
    period,
    highlights,
    breakdown,
    itemType,
    items: paged.items,
    pagination: paged.pagination,
  };
}

module.exports = { ADMIN_INSIGHT_KEYS, buildAdminInsightDetail, buildAdminInsights };
