const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminTransactionList } = require('../api/services/admin-transactions');

const now = new Date('2026-08-18T05:00:00.000Z');

function transaction(id, userId, date, amount, overrides = {}) {
  return {
    id,
    userId,
    tanggal: date,
    nominal: amount,
    tipe: 'operasi',
    arah: 'keluar',
    kategori: 'Makan & Minum',
    deskripsi: '',
    createdAt: `${date}T01:00:00.000Z`,
    sample: false,
    ...overrides,
  };
}

test('membangun daftar transaksi bulan berjalan dengan ringkasan dan allowlist aman', () => {
  const users = [
    { id: 'u1', name: 'Ayu', email: 'ayu@cashly.id', passwordHash: 'hash-rahasia' },
    { id: 'u2', name: 'Bima', email: 'bima@cashly.id', password: 'kata-sandi' },
  ];
  const transactions = [
    transaction('t1', 'u1', '2026-08-18', 1_000_000, {
      arah: 'masuk', kategori: 'Gaji', deskripsi: 'Payroll Agustus',
      createdAt: '2026-08-18T01:00:00.000Z', privateNote: 'jangan-bocor',
    }),
    transaction('t2', 'u2', '2026-08-18', 250_000, {
      tipe: 'investasi', kategori: 'Reksa Dana', createdAt: '2026-08-18T04:00:00.000Z',
    }),
    transaction('t3', 'u1', '2026-08-10', 500_000, {
      tipe: 'pendanaan', arah: 'masuk', kategori: 'Pinjaman', createdAt: 'tanggal-invalid',
    }),
    transaction('july', 'u1', '2026-07-31', 40_000),
    transaction('sample', 'u1', '2026-08-10', 9_000_000, { sample: true }),
    transaction('future', 'u1', '2026-08-19', 8_000_000),
    transaction('orphan', 'tidak-ada', '2026-08-10', 7_000_000),
    transaction('bad-date', 'u1', '2026-02-30', 6_000_000),
    transaction('bad-amount', 'u1', '2026-08-10', 0),
    transaction('bad-type', 'u1', '2026-08-10', 1_000, { tipe: 'lainnya' }),
    transaction('bad-direction', 'u1', '2026-08-10', 1_000, { arah: 'diam' }),
    transaction(null, 'u1', '2026-08-10', 1_000),
  ];

  const result = buildAdminTransactionList(users, transactions, {}, now);

  assert.deepEqual(result.summary, {
    count: 3,
    countLabel: '3',
    volume: 1_750_000,
    volumeLabel: 'Rp 1.750.000',
    inflow: 1_500_000,
    inflowLabel: 'Rp 1.500.000',
    outflow: 250_000,
    outflowLabel: 'Rp 250.000',
  });
  assert.deepEqual(result.filters, {
    q: '', type: 'all', direction: 'all', period: 'month', periodLabel: 'Bulan ini',
    start: '2026-08-01', end: '2026-08-18', timezone: 'Asia/Jakarta',
  });
  assert.deepEqual(result.items.map((item) => item.id), ['t2', 't1', 't3']);
  assert.deepEqual(result.items[0], {
    id: 't2',
    userId: 'u2',
    userName: 'Bima',
    userEmail: 'bima@cashly.id',
    date: '2026-08-18',
    dateLabel: '18 Agu 2026',
    type: 'investasi',
    typeLabel: 'Investasi',
    category: 'Reksa Dana',
    description: '',
    direction: 'keluar',
    directionLabel: 'Pengeluaran',
    amount: 250_000,
    amountLabel: 'Rp 250.000',
    createdAt: '2026-08-18T04:00:00.000Z',
  });
  assert.equal(result.items[2].createdAt, null);
  assert.deepEqual(Object.keys(result.items[0]), [
    'id', 'userId', 'userName', 'userEmail', 'date', 'dateLabel', 'type', 'typeLabel',
    'category', 'description', 'direction', 'directionLabel', 'amount', 'amountLabel', 'createdAt',
  ]);
  assert.doesNotMatch(JSON.stringify(result), /hash-rahasia|kata-sandi|jangan-bocor|password/i);
});

test('pencarian literal mencakup kategori, deskripsi, nama, email, dan kedua id', () => {
  const users = [
    { id: 'user-jose', name: 'José Pratama', email: 'JOSE@example.id' },
    { id: 'user-nina', name: 'Nina', email: 'nina@example.id' },
  ];
  const transactions = [
    transaction('trx-payroll', 'user-jose', '2025-01-01', 100_000, {
      kategori: 'Penghasilan', deskripsi: 'Bonus tahunan', arah: 'masuk',
    }),
    transaction('trx-food', 'user-nina', '2025-01-02', 20_000, {
      kategori: 'Kafe [Pagi]', deskripsi: 'Kopi',
    }),
  ];

  for (const query of ['jose pratama', 'jose@example', 'user-jose', 'trx-payroll', 'penghasilan', 'bonus tahunan']) {
    const result = buildAdminTransactionList(users, transactions, { q: query, period: 'all' }, now);
    assert.deepEqual(result.items.map((item) => item.id), ['trx-payroll'], query);
  }
  assert.deepEqual(
    buildAdminTransactionList(users, transactions, { q: '[PAGI]', period: 'all' }, now)
      .items.map((item) => item.id),
    ['trx-food'],
  );
  assert.doesNotThrow(() => buildAdminTransactionList(
    users, transactions, { q: '[.*(?+', period: 'all' }, now,
  ));
});

test('mendukung alias filter tipe/arah dan menormalkan filter invalid', () => {
  const users = [{ id: 'u1', name: 'Ayu', email: 'ayu@example.id' }];
  const transactions = [
    transaction('investment-out', 'u1', '2026-08-10', 300_000, { tipe: 'investasi' }),
    transaction('investment-in', 'u1', '2026-08-11', 400_000, {
      tipe: 'investasi', arah: 'masuk',
    }),
    transaction('operation-out', 'u1', '2026-08-12', 50_000),
  ];

  const aliases = buildAdminTransactionList(users, transactions, {
    tipe: 'INVESTASI', arah: 'KELUAR', period: 'all',
  }, now);
  assert.deepEqual(aliases.items.map((item) => item.id), ['investment-out']);
  assert.equal(aliases.filters.type, 'investasi');
  assert.equal(aliases.filters.direction, 'keluar');
  assert.deepEqual(aliases.summary, {
    count: 1, countLabel: '1', volume: 300_000, volumeLabel: 'Rp 300.000',
    inflow: 0, inflowLabel: 'Rp 0', outflow: 300_000, outflowLabel: 'Rp 300.000',
  });

  const canonical = buildAdminTransactionList(users, transactions, {
    type: 'operasi', direction: 'keluar', period: 'all',
  }, now);
  assert.deepEqual(canonical.items.map((item) => item.id), ['operation-out']);

  const invalid = buildAdminTransactionList(users, transactions, {
    type: 'bukan-tipe', direction: 'bukan-arah', period: 'kemarin',
  }, now);
  assert.equal(invalid.filters.type, 'all');
  assert.equal(invalid.filters.direction, 'all');
  assert.equal(invalid.filters.period, 'month');
  assert.equal(invalid.pagination.totalItems, 3);
});

test('periode today, week, month, year, dan all mengikuti kalender Asia/Jakarta', () => {
  const users = [{ id: 'u1', name: 'Zona Waktu', email: 'zona@example.id' }];
  const jakartaWednesday = new Date('2026-08-18T17:30:00.000Z'); // 19 Agu 00:30 WIB
  const transactions = [
    transaction('today-iso', 'u1', '2026-01-01', 10_000, {
      tanggal: undefined, date: '2026-08-18T17:05:00.000Z',
    }),
    transaction('monday', 'u1', '2026-08-17', 20_000),
    transaction('sunday', 'u1', '2026-08-16', 30_000),
    transaction('month-start', 'u1', '2026-08-01', 40_000),
    transaction('year-start', 'u1', '2026-01-01', 50_000),
    transaction('previous-year', 'u1', '2025-12-31', 60_000),
    transaction('future', 'u1', '2026-08-20', 9_000_000),
  ];

  const ids = (period) => buildAdminTransactionList(
    users, transactions, { period, limit: 50 }, jakartaWednesday,
  ).items.map((item) => item.id);

  assert.deepEqual(ids('today'), ['today-iso']);
  assert.deepEqual(ids('week'), ['today-iso', 'monday']);
  assert.deepEqual(ids('month'), ['today-iso', 'monday', 'sunday', 'month-start']);
  assert.deepEqual(ids('year'), [
    'today-iso', 'monday', 'sunday', 'month-start', 'year-start',
  ]);
  assert.deepEqual(ids('all'), [
    'today-iso', 'monday', 'sunday', 'month-start', 'year-start', 'previous-year',
  ]);

  const week = buildAdminTransactionList(users, transactions, { period: 'week' }, jakartaWednesday);
  assert.deepEqual(
    { start: week.filters.start, end: week.filters.end, label: week.filters.periodLabel },
    { start: '2026-08-17', end: '2026-08-19', label: 'Minggu ini' },
  );
  assert.equal(week.items[0].date, '2026-08-19');
  assert.equal(week.items[0].dateLabel, '19 Agu 2026');
});

test('mengurutkan tanggal lalu createdAt terbaru dan menjepit pagination', () => {
  const users = [{ id: 'u1', name: 'Ayu', email: 'ayu@example.id' }];
  const transactions = Array.from({ length: 55 }, (_, index) => transaction(
    `trx-${String(index).padStart(2, '0')}`,
    'u1',
    '2026-08-10',
    1_000,
    { createdAt: `2026-08-10T${String(index % 24).padStart(2, '0')}:00:00.000Z` },
  ));

  const defaultPage = buildAdminTransactionList(users, transactions, {}, now);
  assert.equal(defaultPage.items.length, 10);
  assert.equal(defaultPage.pagination.limit, 10);
  assert.equal(defaultPage.pagination.totalItems, 55);

  const lastPage = buildAdminTransactionList(users, transactions, {
    page: 999, limit: 500,
  }, now);
  assert.deepEqual(lastPage.pagination, {
    page: 2, limit: 50, totalItems: 55, totalPages: 2,
    hasPreviousPage: true, hasNextPage: false,
  });
  assert.equal(lastPage.items.length, 5);

  const invalid = buildAdminTransactionList(users, transactions, { page: '-1', limit: '0' }, now);
  assert.equal(invalid.pagination.page, 1);
  assert.equal(invalid.pagination.limit, 10);

  const ordered = buildAdminTransactionList(users, [
    transaction('older-day', 'u1', '2026-08-09', 1_000, { createdAt: '2026-08-18T10:00:00Z' }),
    transaction('early', 'u1', '2026-08-10', 1_000, { createdAt: '2026-08-10T01:00:00Z' }),
    transaction('late', 'u1', '2026-08-10', 1_000, { createdAt: '2026-08-10T09:00:00Z' }),
  ], {}, now);
  assert.deepEqual(ordered.items.map((item) => item.id), ['late', 'early', 'older-day']);
});

test('menerima snake_case, tidak memutasi input, dan menangani input kosong', () => {
  const users = [{
    id: 'u1', name: 'Sari', email: 'sari@example.id', password_hash: 'secret',
  }];
  const transactions = [{
    id: 't1', user_id: 'u1', date: '2026-08-18', amount: '12500', type: 'operasi',
    direction: 'masuk', category: 'Gaji', description: 'Harian',
    created_at: '2026-08-17T17:30:00.000Z', sample: false, secret: 'internal',
  }];
  const usersBefore = structuredClone(users);
  const transactionsBefore = structuredClone(transactions);

  const result = buildAdminTransactionList(users, transactions, null, now);
  assert.equal(result.items[0].amount, 12_500);
  assert.equal(result.items[0].createdAt, '2026-08-17T17:30:00.000Z');
  assert.deepEqual(users, usersBefore);
  assert.deepEqual(transactions, transactionsBefore);
  assert.doesNotMatch(JSON.stringify(result), /secret|internal|password/i);

  assert.deepEqual(buildAdminTransactionList(null, undefined, {}, now), {
    summary: {
      count: 0, countLabel: '0', volume: 0, volumeLabel: 'Rp 0',
      inflow: 0, inflowLabel: 'Rp 0', outflow: 0, outflowLabel: 'Rp 0',
    },
    filters: {
      q: '', type: 'all', direction: 'all', period: 'month', periodLabel: 'Bulan ini',
      start: '2026-08-01', end: '2026-08-18', timezone: 'Asia/Jakarta',
    },
    items: [],
    pagination: {
      page: 1, limit: 10, totalItems: 0, totalPages: 1,
      hasPreviousPage: false, hasNextPage: false,
    },
  });
  assert.throws(
    () => buildAdminTransactionList([], [], {}, 'bukan-tanggal'),
    /tanggal yang valid/,
  );
});
