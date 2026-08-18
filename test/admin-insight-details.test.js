const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ADMIN_INSIGHT_KEYS,
  buildAdminInsightDetail,
  buildAdminInsights,
} = require('../api/services/admin-insights');

const now = new Date('2026-08-18T05:00:00.000Z');

function user(id, day, extra = {}) {
  return {
    id,
    name: `Pengguna ${id}`,
    email: `${id}@example.test`,
    passwordHash: `rahasia-${id}`,
    password_hash: `rahasia-lama-${id}`,
    onboardingDone: Number(day) % 2 === 0,
    createdAt: `2026-08-${String(day).padStart(2, '0')}T02:00:00.000Z`,
    ...extra,
  };
}

function transaction(id, userId, tanggal, nominal, extra = {}) {
  return {
    id,
    userId,
    tanggal,
    tipe: 'operasi',
    arah: 'keluar',
    kategori: 'Makan & Minum',
    nominal,
    sample: false,
    passwordHash: 'tidak-boleh-bocor',
    ...extra,
  };
}

function fixture() {
  const users = Array.from({ length: 13 }, (_, index) => user(`u${index + 1}`, index + 1));
  users.push({ ...users[0], name: 'Duplikat' });
  users.push(user('future-user', 19));
  const transactions = [
    transaction('t1', 'u1', '2026-08-05', 100_000, { arah: 'masuk', kategori: 'Gaji' }),
    transaction('t2', 'u1', '2026-08-10', 25_000),
    transaction('t3', 'u2', '2026-08-12', 75_000, { tipe: 'investasi', kategori: 'Reksa dana' }),
    transaction('sample', 'u3', '2026-08-11', 9_000_000, { sample: true }),
    transaction('future', 'u4', '2026-08-19', 8_000_000),
    transaction('previous', 'u5', '2026-07-05', 7_000_000),
    transaction('invalid', 'u6', '2026-02-30', 6_000_000),
  ];
  return { users, transactions };
}

function assertFiniteNumbers(value) {
  if (typeof value === 'number') assert.equal(Number.isFinite(value), true);
  else if (Array.isArray(value)) value.forEach(assertFiniteNumbers);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFiniteNumbers);
}

test('detail keempat metrik konsisten dengan kartu Home dan memakai periode yang sama', () => {
  const { users, transactions } = fixture();
  const overview = buildAdminInsights(users, transactions, now);

  assert.deepEqual(overview.metrics.map((metric) => metric.key), ADMIN_INSIGHT_KEYS);
  for (const key of ADMIN_INSIGHT_KEYS) {
    const detail = buildAdminInsightDetail(key, users, transactions, {}, now);
    assert.equal(detail.key, key);
    assert.deepEqual(detail.metric, overview.metrics.find((metric) => metric.key === key));
    assert.deepEqual(detail.period, overview.period);
    assert.equal(typeof detail.title, 'string');
    assert.equal(typeof detail.description, 'string');
    assert.ok(detail.highlights.length >= 3);
    assert.ok(Array.isArray(detail.breakdown));
    assertFiniteNumbers(detail.highlights);
    assertFiniteNumbers(detail.breakdown);
  }
});

test('detail pengguna memakai allowlist, mengecualikan pengguna masa depan, dan dipaginasi terbaru', () => {
  const { users, transactions } = fixture();
  const firstPage = buildAdminInsightDetail('total-users', users, transactions, { page: 1, limit: 5 }, now);
  const lastPage = buildAdminInsightDetail('total-users', users, transactions, { page: 99, limit: 5 }, now);

  assert.equal(firstPage.itemType, 'users');
  assert.deepEqual(firstPage.pagination, {
    page: 1,
    limit: 5,
    totalItems: 13,
    totalPages: 3,
    hasPreviousPage: false,
    hasNextPage: true,
  });
  assert.deepEqual(firstPage.items.map((item) => item.id), ['u13', 'u12', 'u11', 'u10', 'u9']);
  assert.equal(lastPage.pagination.page, 3);
  assert.deepEqual(lastPage.items.map((item) => item.id), ['u3', 'u2', 'u1']);
  assert.equal(JSON.stringify(firstPage).includes('rahasia'), false);
  assert.equal(firstPage.items.some((item) => 'passwordHash' in item || 'password_hash' in item), false);
});

test('detail pengguna aktif hanya menghitung transaksi nyata pada periode berjalan', () => {
  const { users, transactions } = fixture();
  const detail = buildAdminInsightDetail('active-users', users, transactions, {}, now);

  assert.equal(detail.itemType, 'users');
  assert.equal(detail.pagination.totalItems, 2);
  assert.deepEqual(detail.items.map((item) => item.id), ['u2', 'u1']);
  assert.deepEqual(detail.items.find((item) => item.id === 'u1'), {
    id: 'u1',
    name: 'Pengguna u1',
    email: 'u1@example.test',
    onboardingDone: false,
    status: 'active',
    statusLabel: 'Aktif',
    joinedAt: '2026-08-01T02:00:00.000Z',
    joinedAtLabel: '01 Agu 2026',
    transactionCount: 2,
    totalVolume: 125_000,
    totalVolumeLabel: 'Rp 125 Rb',
    lastActivity: '2026-08-10',
    lastActivityLabel: '10 Agu 2026',
  });
});

test('detail transaksi mengecualikan sample, tanggal invalid, dan transaksi masa depan', () => {
  const { users, transactions } = fixture();
  const countDetail = buildAdminInsightDetail('total-transactions', users, transactions, {}, now);
  const volumeDetail = buildAdminInsightDetail('transaction-volume', users, transactions, {}, now);

  assert.equal(countDetail.itemType, 'transactions');
  assert.equal(countDetail.pagination.totalItems, 3);
  assert.deepEqual(countDetail.items.map((item) => item.id), ['t3', 't2', 't1']);
  assert.equal(countDetail.items[0].userName, 'Pengguna u2');
  assert.equal(countDetail.items[0].userEmail, 'u2@example.test');
  assert.equal(countDetail.items[0].typeLabel, 'Investasi');
  assert.equal(countDetail.items[0].directionLabel, 'Pengeluaran');
  assert.equal(countDetail.items[0].amountLabel, 'Rp 75 Rb');
  assert.equal(countDetail.items[0].description, '');
  assert.equal(JSON.stringify(countDetail).includes('tidak-boleh-bocor'), false);
  assert.equal(volumeDetail.metric.value, 'Rp 200 Rb');
  assert.deepEqual(volumeDetail.items, countDetail.items);
});

test('pagination detail memiliki default 10, limit maksimum 50, dan key asing ditolak', () => {
  const manyUsers = Array.from({ length: 55 }, (_, index) => user(`u${index + 1}`, 1, {
    createdAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T02:00:00.000Z`,
  }));
  const defaultPage = buildAdminInsightDetail('total-users', manyUsers, [], {}, now);
  const cappedPage = buildAdminInsightDetail('total-users', manyUsers, [], { limit: 500 }, now);

  assert.equal(defaultPage.items.length, 10);
  assert.equal(defaultPage.pagination.limit, 10);
  assert.equal(cappedPage.items.length, 50);
  assert.equal(cappedPage.pagination.limit, 50);
  assert.equal(buildAdminInsightDetail('bukan-metrik', manyUsers, [], {}, now), null);
});
