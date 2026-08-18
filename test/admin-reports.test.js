const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAdminReport } = require('../api/services/admin-reports');

const now = new Date('2026-08-18T05:00:00.000Z');

function user(id, createdAt = '2026-01-01T00:00:00.000Z', extra = {}) {
  return {
    id,
    name: `Pengguna ${id}`,
    email: `${id}@example.test`,
    passwordHash: `rahasia-${id}`,
    createdAt,
    onboardingDone: false,
    ...extra,
  };
}

function transaction(id, userId, tanggal, nominal, extra = {}) {
  return {
    id,
    userId,
    tanggal,
    nominal,
    tipe: 'operasi',
    arah: 'keluar',
    kategori: 'Makan & Minum',
    deskripsi: `Rahasia transaksi ${id}`,
    sample: false,
    ...extra,
  };
}

function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}

function assertFiniteNumbers(value) {
  if (typeof value === 'number') assert.equal(Number.isFinite(value), true);
  else if (Array.isArray(value)) value.forEach(assertFiniteNumbers);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFiniteNumbers);
}

test('laporan bulanan mengagregasi arus kas, komposisi, kategori, dan aktivitas pengguna', () => {
  const users = [
    user('u1', '2026-01-02T00:00:00.000Z', { onboardingDone: true }),
    user('u2', '2026-08-03T00:00:00.000Z'),
    user('u3', '2026-07-01T00:00:00.000Z', { onboardingDone: true }),
  ];
  const transactions = [
    transaction('t1', 'u1', '2026-08-01', 1_000, {
      arah: 'masuk', kategori: 'Gaji', tipe: 'operasi',
    }),
    transaction('t2', 'u1', '2026-08-02', 400, {
      arah: 'keluar', kategori: 'Makan & Minum', tipe: 'operasi',
    }),
    transaction('t3', 'u2', '2026-08-03', 300, {
      arah: 'keluar', kategori: 'Reksa Dana', tipe: 'investasi',
    }),
    transaction('t4', 'u2', '2026-08-04', 500, {
      arah: 'masuk', kategori: 'Modal', tipe: 'pendanaan',
    }),
  ];

  const result = buildAdminReport(users, transactions, {}, now);

  assert.deepEqual(result.period, {
    key: 'month',
    label: 'Agustus 2026',
    start: '2026-08-01',
    end: '2026-08-18',
    timezone: 'Asia/Jakarta',
    granularity: 'day',
  });
  assert.deepEqual(result.summary, {
    transactionCount: 4,
    transactionCountLabel: '4 transaksi',
    totalVolume: 2_200,
    totalVolumeLabel: 'Rp 2.200',
    inflow: 1_500,
    inflowLabel: 'Rp 1.500',
    outflow: 700,
    outflowLabel: 'Rp 700',
    netFlow: 800,
    netFlowLabel: 'Rp 800',
    activeUsers: 2,
    activeUsersLabel: '2 pengguna',
  });
  assert.deepEqual(result.cashFlow.map(({ key, inflow, outflow, net, count }) => ({
    key, inflow, outflow, net, count,
  })), [
    { key: 'operasi', inflow: 1_000, outflow: 400, net: 600, count: 2 },
    { key: 'investasi', inflow: 0, outflow: 300, net: -300, count: 1 },
    { key: 'pendanaan', inflow: 500, outflow: 0, net: 500, count: 1 },
  ]);
  assert.deepEqual(result.types.byType.map(({ key, count, percentage }) => ({ key, count, percentage })), [
    { key: 'operasi', count: 2, percentage: 63.7 },
    { key: 'investasi', count: 1, percentage: 13.6 },
    { key: 'pendanaan', count: 1, percentage: 22.7 },
  ]);
  assert.deepEqual(result.types.byDirection.map(({ key, count, percentage }) => ({
    key, count, percentage,
  })), [
    { key: 'masuk', count: 2, percentage: 68.2 },
    { key: 'keluar', count: 2, percentage: 31.8 },
  ]);
  assert.deepEqual(result.categories.map(({ rank, name, volume, count, percentage }) => ({
    rank, name, volume, count, percentage,
  })), [
    { rank: 1, name: 'Gaji', volume: 1_000, count: 1, percentage: 45.5 },
    { rank: 2, name: 'Modal', volume: 500, count: 1, percentage: 22.7 },
    { rank: 3, name: 'Makan & Minum', volume: 400, count: 1, percentage: 18.2 },
    { rank: 4, name: 'Reksa Dana', volume: 300, count: 1, percentage: 13.6 },
  ]);
  assert.deepEqual(result.userActivity, {
    totalUsers: 3,
    totalUsersLabel: '3 pengguna',
    activeUsers: 2,
    activeUsersLabel: '2 pengguna',
    newUsers: 1,
    newUsersLabel: '1 pengguna baru',
    onboardingCompleted: 2,
    onboardingCompletedLabel: '2 pengguna',
    activeRate: 66.7,
    activeRateLabel: '66,7%',
    onboardingRate: 66.7,
    onboardingRateLabel: '66,7%',
  });
});

test('month, quarter, year, dan all memakai batas inklusif yang benar', () => {
  const users = [user('u1', '2025-11-01T00:00:00.000Z')];
  const transactions = [
    transaction('old', 'u1', '2025-12-31', 10),
    transaction('year-start', 'u1', '2026-01-01', 20),
    transaction('quarter-before', 'u1', '2026-06-30', 30),
    transaction('quarter-start', 'u1', '2026-07-01', 40),
    transaction('month-before', 'u1', '2026-07-31', 50),
    transaction('month-start', 'u1', '2026-08-01', 60),
    transaction('today', 'u1', '2026-08-18', 70),
    transaction('future', 'u1', '2026-08-19', 99_999),
  ];

  const month = buildAdminReport(users, transactions, {}, now);
  const fallback = buildAdminReport(users, transactions, { period: 'tidak-valid' }, now);
  const quarter = buildAdminReport(users, transactions, { period: 'QUARTER' }, now);
  const year = buildAdminReport(users, transactions, { period: ['year', 'all'] }, now);
  const all = buildAdminReport(users, transactions, { period: 'all' }, now);

  assert.equal(month.summary.transactionCount, 2);
  assert.equal(fallback.period.key, 'month');
  assert.equal(quarter.period.start, '2026-07-01');
  assert.equal(quarter.summary.transactionCount, 4);
  assert.equal(year.period.start, '2026-01-01');
  assert.equal(year.summary.transactionCount, 6);
  assert.equal(all.period.start, '2025-11-01');
  assert.equal(all.summary.transactionCount, 7);
  assert.equal(month.trend.length, 18);
  assert.equal(quarter.trend.length, 49);
  assert.equal(year.trend.length, 8);
  assert.equal(all.trend.length, 10);
  assert.deepEqual(month.trend.slice(0, 2).map(({ key, label }) => ({ key, label })), [
    { key: '2026-08-01', label: '1 Agu' },
    { key: '2026-08-02', label: '2 Agu' },
  ]);
  assert.deepEqual(year.trend.slice(0, 2).map(({ key, label }) => ({ key, label })), [
    { key: '2026-01', label: 'Jan' },
    { key: '2026-02', label: 'Feb' },
  ]);
  assert.deepEqual(all.trend.slice(0, 2).map(({ key, label }) => ({ key, label })), [
    { key: '2025-11', label: 'Nov 2025' },
    { key: '2025-12', label: 'Des 2025' },
  ]);
});

test('batas hari dan timestamp tanpa offset ditafsirkan dalam Asia/Jakarta', () => {
  const jakartaNow = new Date('2026-08-31T17:30:00.000Z'); // 1 September 00:30 WIB
  const users = [
    user('old', '2026-08-31T16:59:00.000Z'),
    user('new', '2026-08-31T17:15:00.000Z'),
    user('future-user', '2026-08-31T17:45:00.000Z'),
  ];
  const transactions = [
    transaction('august', 'old', '2026-08-31T16:59:00.000Z', 10),
    transaction('september-z', 'new', '2026-08-31T17:00:00.000Z', 20),
    transaction('september-local', 'new', '2026-09-01T00:10:00', 30),
    transaction('future-instant', 'new', '2026-09-01T00:45:00+07:00', 40),
  ];

  const result = buildAdminReport(users, transactions, {}, jakartaNow);

  assert.equal(result.period.start, '2026-09-01');
  assert.equal(result.period.end, '2026-09-01');
  assert.equal(result.summary.transactionCount, 2);
  assert.equal(result.summary.totalVolume, 50);
  assert.equal(result.userActivity.totalUsers, 2);
  assert.equal(result.userActivity.newUsers, 1);
  assert.equal(result.trend[0].key, '2026-09-01');
});

test('mengabaikan sample, invalid, masa depan, orphan, user invalid, dan tidak memutasi input', () => {
  const users = [
    user('valid'),
    { ...user('duplicate'), id: 'valid' },
    user('invalid-date', 'bukan-tanggal'),
    user('future-user', '2026-08-19T00:00:00.000Z'),
    null,
  ];
  const transactions = [
    transaction('valid', 'valid', '2026-08-01', 100, {
      kategori: '  Makan\u0000   &   Minum  ',
    }),
    transaction('sample', 'valid', '2026-08-02', 200, { sample: true }),
    transaction('bad-date', 'valid', '2026-02-30', 300),
    transaction('bad-amount', 'valid', '2026-08-03', Number.NaN),
    transaction('zero', 'valid', '2026-08-03', 0),
    transaction('bad-type', 'valid', '2026-08-03', 400, { tipe: 'lainnya' }),
    transaction('bad-direction', 'valid', '2026-08-03', 500, { arah: 'transfer' }),
    transaction('orphan', 'missing', '2026-08-03', 600),
    transaction('invalid-user', 'invalid-date', '2026-08-03', 700),
    transaction('future-user', 'future-user', '2026-08-03', 800),
    transaction('future', 'valid', '2026-08-19', 900),
  ];
  const usersBefore = structuredClone(users);
  const transactionsBefore = structuredClone(transactions);

  const result = buildAdminReport(users, transactions, {}, now);
  const serialized = JSON.stringify(result);

  assert.equal(result.summary.transactionCount, 1);
  assert.equal(result.summary.totalVolume, 100);
  assert.equal(result.categories[0].name, 'Makan & Minum');
  assert.equal(result.userActivity.totalUsers, 1);
  assert.equal(serialized.includes('rahasia-'), false);
  assert.equal(serialized.includes('Rahasia transaksi'), false);
  assert.equal(serialized.includes('@example.test'), false);
  assertFiniteNumbers(result);
  assert.deepEqual(users, usersBefore);
  assert.deepEqual(transactions, transactionsBefore);
  assert.throws(() => buildAdminReport([], [], {}, 'bukan-tanggal'), /tanggal yang valid/);
});

test('seluruh subtotal konsisten secara aritmetika dan persentase komposisi tepat 100%', () => {
  const users = [user('u1'), user('u2')];
  const transactions = [
    transaction('1', 'u1', '2026-08-01', 100, { arah: 'masuk', tipe: 'operasi' }),
    transaction('2', 'u1', '2026-08-02', 200, { arah: 'keluar', tipe: 'operasi' }),
    transaction('3', 'u2', '2026-08-03', 300, { arah: 'keluar', tipe: 'investasi' }),
  ];
  const result = buildAdminReport(users, transactions, {}, now);

  assert.equal(sum(result.trend, 'count'), result.summary.transactionCount);
  assert.equal(sum(result.trend, 'volume'), result.summary.totalVolume);
  assert.equal(sum(result.trend, 'inflow'), result.summary.inflow);
  assert.equal(sum(result.trend, 'outflow'), result.summary.outflow);
  assert.equal(sum(result.cashFlow, 'count'), result.summary.transactionCount);
  assert.equal(sum(result.cashFlow, 'inflow'), result.summary.inflow);
  assert.equal(sum(result.cashFlow, 'outflow'), result.summary.outflow);
  assert.equal(sum(result.types.byType, 'count'), result.summary.transactionCount);
  assert.equal(sum(result.types.byDirection, 'count'), result.summary.transactionCount);
  assert.equal(sum(result.types.byType, 'percentage'), 100);
  assert.equal(sum(result.types.byDirection, 'percentage'), 100);
  assert.equal(result.summary.netFlow, result.summary.inflow - result.summary.outflow);
});

test('persentase tipe dan arah mengikuti volume, bukan jumlah transaksi', () => {
  const users = [user('u1')];
  const transactions = Array.from({ length: 9 }, (_, index) => transaction(
    `small-${index}`,
    'u1',
    `2026-08-${String(index + 1).padStart(2, '0')}`,
    1,
    { tipe: 'operasi', arah: 'keluar' },
  ));
  transactions.push(transaction('large', 'u1', '2026-08-10', 991, {
    tipe: 'investasi', arah: 'masuk',
  }));

  const result = buildAdminReport(users, transactions, {}, now);
  const byType = Object.fromEntries(result.types.byType.map((row) => [row.key, row]));
  const byDirection = Object.fromEntries(result.types.byDirection.map((row) => [row.key, row]));

  assert.equal(byType.operasi.count, 9);
  assert.equal(byType.operasi.volume, 9);
  assert.equal(byType.operasi.percentage, 0.9);
  assert.equal(byType.investasi.count, 1);
  assert.equal(byType.investasi.volume, 991);
  assert.equal(byType.investasi.percentage, 99.1);
  assert.equal(byDirection.keluar.count, 9);
  assert.equal(byDirection.keluar.percentage, 0.9);
  assert.equal(byDirection.masuk.count, 1);
  assert.equal(byDirection.masuk.percentage, 99.1);
  assert.equal(sum(result.types.byType, 'percentage'), 100);
  assert.equal(sum(result.types.byDirection, 'percentage'), 100);
});

test('kategori hingga 120 karakter tidak digabung hanya karena prefix 80 karakter sama', () => {
  const sharedPrefix = 'Kategori sangat panjang '.padEnd(80, 'x');
  const firstCategory = `${sharedPrefix} pembeda pertama`;
  const secondCategory = `${sharedPrefix} pembeda kedua`;
  const result = buildAdminReport([user('u1')], [
    transaction('first', 'u1', '2026-08-01', 200, { kategori: firstCategory }),
    transaction('second', 'u1', '2026-08-02', 100, { kategori: secondCategory }),
  ], {}, now);

  assert.ok(firstCategory.length <= 120);
  assert.ok(secondCategory.length <= 120);
  assert.equal(firstCategory.slice(0, 80), secondCategory.slice(0, 80));
  assert.equal(result.categories.length, 2);
  assert.deepEqual(result.categories.map(({ name, count, volume }) => ({ name, count, volume })), [
    { name: firstCategory, count: 1, volume: 200 },
    { name: secondCategory, count: 1, volume: 100 },
  ]);
});

test('data kosong dan periode all tetap menghasilkan kontrak stabil tanpa NaN', () => {
  const result = buildAdminReport(null, undefined, { period: 'all' }, now);

  assert.deepEqual(Object.keys(result), [
    'period', 'summary', 'trend', 'cashFlow', 'types', 'categories', 'userActivity',
  ]);
  assert.deepEqual(result.period, {
    key: 'all',
    label: 'Semua waktu',
    start: '2026-08-18',
    end: '2026-08-18',
    timezone: 'Asia/Jakarta',
    granularity: 'month',
  });
  assert.equal(result.summary.transactionCount, 0);
  assert.equal(result.trend.length, 1);
  assert.equal(result.trend[0].key, '2026-08');
  assert.deepEqual(result.cashFlow.map((row) => row.key), ['operasi', 'investasi', 'pendanaan']);
  assert.deepEqual(result.types.byDirection.map((row) => row.percentage), [0, 0]);
  assert.deepEqual(result.categories, []);
  assert.equal(result.userActivity.totalUsers, 0);
  assertFiniteNumbers(result);
});
