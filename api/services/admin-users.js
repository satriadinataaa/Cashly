const TIMEZONE = 'Asia/Jakarta';
const RECENT_WINDOW_DAYS = 30;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

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

function parseInstant(value, dateOnlyInJakarta = false) {
  if (value == null || value === '') return null;
  if (dateOnlyInJakarta) {
    const dateOnly = validDateOnly(value);
    if (dateOnly) return new Date(`${dateOnly}T00:00:00.000+07:00`);
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function userJoinedAt(user) {
  return parseInstant(user && (user.createdAt ?? user.created_at));
}

function transactionActivity(transaction) {
  const timestampFields = [
    transaction && transaction.updatedAt,
    transaction && transaction.updated_at,
    transaction && transaction.createdAt,
    transaction && transaction.created_at,
  ];
  for (const value of timestampFields) {
    const instant = parseInstant(value);
    if (instant) return instant;
  }
  return parseInstant(transaction && (transaction.tanggal ?? transaction.date), true);
}

function userIdOf(transaction) {
  const value = transaction && (transaction.userId ?? transaction.user_id);
  return value == null || value === '' ? null : String(value);
}

function amountOf(transaction) {
  const amount = Number(transaction && (transaction.nominal ?? transaction.amount));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function safeAdd(left, right) {
  const result = left + right;
  return Number.isFinite(result) ? result : Number.MAX_VALUE;
}

function formatCurrency(value) {
  return `Rp ${integerFormatter.format(Number.isFinite(value) ? value : 0)}`;
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

function calendarDayDifference(later, earlier) {
  const toUtcDay = (date) => {
    const [year, month, day] = jakartaDateKey(date).split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtcDay(later) - toUtcDay(earlier)) / 86_400_000);
}

function formatDate(date) {
  return date ? dateFormatter.format(date).replace(/\./g, '') : '—';
}

function formatLastActivity(date, now) {
  if (!date) return 'Belum ada aktivitas';
  const days = calendarDayDifference(now, date);
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Kemarin';
  if (days > 1 && days < 7) return `${days} hari lalu`;
  return formatDate(date);
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

function normalizeUsers(users) {
  const seen = new Set();
  const normalized = [];
  for (const user of Array.isArray(users) ? users : []) {
    if (!user || typeof user !== 'object' || user.id == null || user.id === '') continue;
    const key = String(user.id);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ user, key, joinedDate: userJoinedAt(user) });
  }
  return normalized;
}

function transactionsByUser(transactions, knownUserIds) {
  const grouped = new Map();
  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    if (!transaction || typeof transaction !== 'object' || transaction.sample === true) continue;
    const userId = userIdOf(transaction);
    if (!userId || !knownUserIds.has(userId)) continue;
    if (!grouped.has(userId)) grouped.set(userId, []);
    grouped.get(userId).push(transaction);
  }
  return grouped;
}

function statusFor(joinedAt, lastActivity, now) {
  const recentCutoff = now.getTime() - (RECENT_WINDOW_DAYS * 86_400_000);
  if (lastActivity && lastActivity <= now && lastActivity.getTime() >= recentCutoff) return 'active';
  if (joinedAt && joinedAt <= now && joinedAt.getTime() >= recentCutoff) return 'new';
  return 'inactive';
}

function enrichUser(entry, transactions, now) {
  let totalVolume = 0;
  let lastActivityDate = null;
  for (const transaction of transactions) {
    totalVolume = safeAdd(totalVolume, amountOf(transaction));
    const activity = transactionActivity(transaction);
    if (activity && (!lastActivityDate || activity > lastActivityDate)) lastActivityDate = activity;
  }

  const status = statusFor(entry.joinedDate, lastActivityDate, now);
  const statusLabels = { active: 'Aktif', inactive: 'Tidak aktif', new: 'Baru' };
  const name = String(entry.user.name ?? '').trim() || 'Pengguna';
  const email = String(entry.user.email ?? '').trim();

  // Explicit allowlist keeps password hashes and any future sensitive user fields out of this response.
  return {
    id: entry.user.id,
    name,
    email,
    onboardingDone: Boolean(entry.user.onboardingDone ?? entry.user.onboarding_done),
    status,
    statusLabel: statusLabels[status],
    transactionCount: transactions.length,
    totalVolume,
    totalVolumeLabel: formatCurrency(totalVolume),
    lastActivity: lastActivityDate ? lastActivityDate.toISOString() : null,
    lastActivityLabel: formatLastActivity(lastActivityDate, now),
    joinedAt: entry.joinedDate ? entry.joinedDate.toISOString() : null,
    joinedAtLabel: formatDate(entry.joinedDate),
  };
}

function buildAdminUserList(users, transactions, query = {}, nowValue) {
  const now = asDate(nowValue, new Date());
  const safeQuery = query && typeof query === 'object' ? query : {};
  const normalizedUsers = normalizeUsers(users);
  const groupedTransactions = transactionsByUser(
    transactions,
    new Set(normalizedUsers.map((entry) => entry.key)),
  );
  const allItems = normalizedUsers.map((entry) => (
    enrichUser(entry, groupedTransactions.get(entry.key) || [], now)
  ));

  const summary = {
    total: allItems.length,
    // Pengguna baru tetap dihitung aktif bila memiliki aktivitas 30 hari terakhir.
    active: allItems.filter((item) => item.lastActivity
      && Date.parse(item.lastActivity) >= now.getTime() - (RECENT_WINDOW_DAYS * 86_400_000)).length,
    inactive: allItems.filter((item) => item.status === 'inactive').length,
    new: allItems.filter((item) => item.joinedAt
      && Date.parse(item.joinedAt) >= now.getTime() - (RECENT_WINDOW_DAYS * 86_400_000)).length,
    totalTransactions: allItems.reduce((sum, item) => sum + item.transactionCount, 0),
  };

  const search = normalizeText(scalarQueryValue(safeQuery.q || safeQuery.search).slice(0, 200));
  const requestedStatus = normalizeText(scalarQueryValue(safeQuery.status));
  const status = ['active', 'inactive', 'new'].includes(requestedStatus) ? requestedStatus : 'all';
  const requestedPage = positiveInteger(safeQuery.page, 1);
  const limit = positiveInteger(safeQuery.limit, DEFAULT_LIMIT, MAX_LIMIT);

  const filtered = allItems
    .filter((item) => status === 'all' || item.status === status)
    .filter((item) => !search || normalizeText(`${item.name} ${item.email} ${item.id}`).includes(search))
    .sort((left, right) => {
      const joinedDifference = (Date.parse(right.joinedAt) || 0) - (Date.parse(left.joinedAt) || 0);
      return joinedDifference || left.name.localeCompare(right.name, 'id-ID')
        || String(left.id).localeCompare(String(right.id), 'id-ID');
    });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const page = Math.min(requestedPage, totalPages);
  const start = Math.min((page - 1) * limit, Number.MAX_SAFE_INTEGER);

  return {
    items: filtered.slice(start, start + limit),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    summary,
  };
}

module.exports = { buildAdminUserList };
