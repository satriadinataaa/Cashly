const TIMEZONE = 'Asia/Jakarta';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const TYPES = Object.freeze(['operasi', 'investasi', 'pendanaan']);
const DIRECTIONS = Object.freeze(['masuk', 'keluar']);
const PERIODS = Object.freeze(['month', 'today', 'week', 'year', 'all']);

const integerFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function asDate(value, fallback) {
  const date = value === undefined ? fallback : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('now harus berupa tanggal yang valid.');
  }
  return date;
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

function normalizeText(value) {
  if (value == null) return '';
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id-ID')
    .replace(/\s+/g, ' ')
    .trim();
}

function validDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function jakartaDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function transactionDateKey(transaction) {
  const value = transaction && (transaction.tanggal ?? transaction.date);
  const dateOnly = validDateOnly(value);
  if (dateOnly) return dateOnly;
  if (value == null || value === '') return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : jakartaDateKey(instant);
}

function instantOf(value) {
  if (value == null || value === '') return null;
  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function shiftDateKey(dateKey, numberOfDays) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + numberOfDays));
  return shifted.toISOString().slice(0, 10);
}

function periodRange(period, now) {
  const end = jakartaDateKey(now);
  const [year, month] = end.split('-');
  if (period === 'today') return { start: end, end, label: 'Hari ini' };
  if (period === 'week') {
    const [weekYear, weekMonth, weekDay] = end.split('-').map(Number);
    const weekday = new Date(Date.UTC(weekYear, weekMonth - 1, weekDay)).getUTCDay();
    return { start: shiftDateKey(end, -((weekday + 6) % 7)), end, label: 'Minggu ini' };
  }
  if (period === 'year') return { start: `${year}-01-01`, end, label: 'Tahun ini' };
  if (period === 'all') return { start: null, end, label: 'Semua waktu' };
  return { start: `${year}-${month}-01`, end, label: 'Bulan ini' };
}

function userIdOf(transaction) {
  const value = transaction && (transaction.userId ?? transaction.user_id);
  return value == null || value === '' ? null : String(value);
}

function amountOf(transaction) {
  const value = Number(transaction && (transaction.nominal ?? transaction.amount));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function valueFromAllowlist(value, allowlist, fallback = 'all') {
  const normalized = normalizeText(scalarQueryValue(value));
  return allowlist.includes(normalized) ? normalized : fallback;
}

function safeAdd(left, right) {
  const result = left + right;
  return Number.isSafeInteger(result) ? result : Number.MAX_SAFE_INTEGER;
}

function formatInteger(value) {
  return integerFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatCurrency(value) {
  return `Rp ${formatInteger(value)}`;
}

function formatDate(dateKey) {
  const instant = new Date(`${dateKey}T00:00:00.000+07:00`);
  return dateFormatter.format(instant).replace(/\./g, '');
}

function typeLabel(value) {
  return { operasi: 'Operasional', investasi: 'Investasi', pendanaan: 'Pendanaan' }[value];
}

function directionLabel(value) {
  return { masuk: 'Pemasukan', keluar: 'Pengeluaran' }[value];
}

function normalizeUsers(users) {
  const result = new Map();
  for (const user of Array.isArray(users) ? users : []) {
    if (!user || typeof user !== 'object' || user.id == null || user.id === '') continue;
    const userId = String(user.id);
    if (result.has(userId)) continue;
    result.set(userId, {
      id: userId,
      name: String(user.name ?? '').trim() || 'Pengguna',
      email: String(user.email ?? '').trim(),
    });
  }
  return result;
}

function normalizeTransactions(transactions, users, today) {
  const result = [];
  for (const [order, transaction] of (Array.isArray(transactions) ? transactions : []).entries()) {
    if (!transaction || typeof transaction !== 'object' || transaction.sample === true) continue;
    if (transaction.id == null || transaction.id === '') continue;

    const userId = userIdOf(transaction);
    const user = userId ? users.get(userId) : null;
    const date = transactionDateKey(transaction);
    const amount = amountOf(transaction);
    const type = normalizeText(transaction.tipe ?? transaction.type);
    const direction = normalizeText(transaction.arah ?? transaction.direction);
    if (!user || !date || date > today || amount == null
      || !TYPES.includes(type) || !DIRECTIONS.includes(direction)) continue;

    const createdInstant = instantOf(transaction.createdAt ?? transaction.created_at);
    const createdAt = createdInstant ? createdInstant.toISOString() : null;
    const category = String(transaction.kategori ?? transaction.category ?? '').trim() || 'Tanpa kategori';
    const description = String(transaction.deskripsi ?? transaction.description ?? '').trim();

    // Explicit allowlist: transaction/user objects are never spread into the response.
    result.push({
      item: {
        id: transaction.id,
        userId,
        userName: user.name,
        userEmail: user.email,
        date,
        dateLabel: formatDate(date),
        type,
        typeLabel: typeLabel(type),
        category,
        description,
        direction,
        directionLabel: directionLabel(direction),
        amount,
        amountLabel: formatCurrency(amount),
        createdAt,
      },
      searchText: normalizeText([
        transaction.id, userId, user.name, user.email, category, description,
      ].join(' ')),
      createdTime: createdInstant ? createdInstant.getTime() : 0,
      order,
    });
  }
  return result;
}

function buildAdminTransactionList(users, transactions, query = {}, nowValue) {
  const now = asDate(nowValue, new Date());
  const safeQuery = query && typeof query === 'object' ? query : {};
  const q = scalarQueryValue(safeQuery.q).trim().slice(0, 200);
  const search = normalizeText(q);
  const type = valueFromAllowlist(safeQuery.type ?? safeQuery.tipe, ['all', ...TYPES]);
  const direction = valueFromAllowlist(
    safeQuery.direction ?? safeQuery.arah,
    ['all', ...DIRECTIONS],
  );
  const period = valueFromAllowlist(safeQuery.period, PERIODS, 'month');
  const range = periodRange(period, now);
  const requestedPage = positiveInteger(safeQuery.page, 1);
  const limit = positiveInteger(safeQuery.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const knownUsers = normalizeUsers(users);

  const filtered = normalizeTransactions(transactions, knownUsers, range.end)
    .filter(({ item }) => !range.start || item.date >= range.start)
    .filter(({ item }) => type === 'all' || item.type === type)
    .filter(({ item }) => direction === 'all' || item.direction === direction)
    .filter((entry) => !search || entry.searchText.includes(search))
    .sort((left, right) => right.item.date.localeCompare(left.item.date)
      || right.createdTime - left.createdTime
      || String(right.item.id).localeCompare(String(left.item.id), 'id-ID')
      || right.order - left.order);

  let volume = 0;
  let inflow = 0;
  let outflow = 0;
  for (const { item } of filtered) {
    volume = safeAdd(volume, item.amount);
    if (item.direction === 'masuk') inflow = safeAdd(inflow, item.amount);
    else outflow = safeAdd(outflow, item.amount);
  }

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const page = Math.min(requestedPage, totalPages);
  const start = Math.min((page - 1) * limit, Number.MAX_SAFE_INTEGER);

  return {
    summary: {
      count: totalItems,
      countLabel: formatInteger(totalItems),
      volume,
      volumeLabel: formatCurrency(volume),
      inflow,
      inflowLabel: formatCurrency(inflow),
      outflow,
      outflowLabel: formatCurrency(outflow),
    },
    filters: {
      q,
      type,
      direction,
      period,
      periodLabel: range.label,
      start: range.start,
      end: range.end,
      timezone: TIMEZONE,
    },
    items: filtered.slice(start, start + limit).map(({ item }) => item),
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

module.exports = { buildAdminTransactionList };
