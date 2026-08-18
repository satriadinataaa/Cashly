const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminUserList } = require('../api/services/admin-users');

const now = new Date('2026-08-18T05:00:00.000Z');

test('membangun daftar pengguna dari transaksi asli tanpa membocorkan password', () => {
  const users = [
    {
      id: 'new', name: 'Nadia Baru', email: 'nadia@cashly.id',
      passwordHash: 'hash-yang-rahasia', createdAt: '2026-08-01T02:00:00.000Z', onboardingDone: true,
    },
    {
      id: 'active', name: 'Andi Aktif', email: 'andi@cashly.id',
      password: 'jangan-kirim', createdAt: '2025-01-01T02:00:00.000Z', onboardingDone: true,
    },
    {
      id: 'inactive', name: 'Ina Lama', email: 'ina@cashly.id',
      password_hash: 'juga-rahasia', createdAt: '2025-02-01T02:00:00.000Z', onboardingDone: false,
    },
    { id: 'idle', name: 'Tanpa Transaksi', email: 'idle@cashly.id', createdAt: '2025-03-01T02:00:00.000Z' },
  ];
  const transactions = [
    {
      id: 'n1', userId: 'new', nominal: 50_000, tanggal: '2026-08-02',
      createdAt: '2026-08-02T03:00:00.000Z', updatedAt: '2026-08-02T03:00:00.000Z', sample: false,
    },
    {
      id: 'a1', userId: 'active', nominal: 150_000, tanggal: '2026-08-01',
      createdAt: '2026-08-01T03:00:00.000Z', updatedAt: '2026-08-17T05:00:00.000Z', sample: false,
    },
    {
      id: 'a2', userId: 'active', nominal: '25000', tanggal: '2026-06-01',
      createdAt: '2026-06-01T03:00:00.000Z', sample: false,
    },
    {
      id: 'i1', userId: 'inactive', nominal: 75_000, tanggal: '2026-06-01',
      createdAt: '2026-06-01T03:00:00.000Z', sample: false,
    },
    { id: 'sample', userId: 'new', nominal: 999_000, tanggal: '2026-08-10', sample: true },
    { id: 'orphan', userId: 'tidak-ada', nominal: 1_000, tanggal: '2026-08-10', sample: false },
  ];

  const result = buildAdminUserList(users, transactions, {}, now);

  assert.deepEqual(result.summary, {
    total: 4, active: 2, inactive: 2, new: 1, totalTransactions: 4,
  });
  assert.deepEqual(result.pagination, {
    page: 1, limit: 10, totalItems: 4, totalPages: 1,
    hasPreviousPage: false, hasNextPage: false,
  });

  const active = result.items.find((item) => item.id === 'active');
  assert.deepEqual(active, {
    id: 'active',
    name: 'Andi Aktif',
    email: 'andi@cashly.id',
    onboardingDone: true,
    status: 'active',
    statusLabel: 'Aktif',
    transactionCount: 2,
    totalVolume: 175_000,
    totalVolumeLabel: 'Rp 175.000',
    lastActivity: '2026-08-17T05:00:00.000Z',
    lastActivityLabel: 'Kemarin',
    joinedAt: '2025-01-01T02:00:00.000Z',
    joinedAtLabel: '01 Jan 2025',
  });
  assert.equal(result.items.find((item) => item.id === 'new').status, 'active');
  assert.equal(result.items.find((item) => item.id === 'inactive').status, 'inactive');
  assert.equal(result.items.find((item) => item.id === 'idle').lastActivityLabel, 'Belum ada aktivitas');

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /hash-yang-rahasia|jangan-kirim|juga-rahasia/);
  assert.doesNotMatch(serialized, /password/i);
});

test('mendukung pencarian literal, filter status, dan pencarian tanpa membedakan aksen', () => {
  const users = [
    { id: '1', name: 'José Santoso', email: 'jose@example.id', createdAt: '2020-01-01T00:00:00.000Z' },
    { id: '2', name: 'Nur Aini', email: 'NUR@example.id', createdAt: '2026-08-10T00:00:00.000Z' },
    { id: '3', name: 'Budi', email: 'budi@example.id', createdAt: '2020-01-01T00:00:00.000Z' },
  ];
  const transactions = [{
    id: 't1', userId: '1', nominal: 10_000, createdAt: '2026-08-18T00:00:00.000Z', sample: false,
  }];

  const accentInsensitive = buildAdminUserList(users, transactions, { q: '  JOSE  ' }, now);
  assert.deepEqual(accentInsensitive.items.map((item) => item.id), ['1']);

  const newUsers = buildAdminUserList(users, transactions, { search: 'nur@', status: 'NEW' }, now);
  assert.deepEqual(newUsers.items.map((item) => item.id), ['2']);
  assert.equal(newUsers.pagination.totalItems, 1);
  assert.deepEqual(newUsers.summary, {
    total: 3, active: 1, inactive: 1, new: 1, totalTransactions: 1,
  });

  assert.doesNotThrow(() => buildAdminUserList(users, transactions, { q: '[.*(?+' }, now));
  assert.deepEqual(buildAdminUserList(users, transactions, { q: '[.*(?+' }, now).items, []);
  assert.equal(buildAdminUserList(users, transactions, { status: 'status-tidak-valid' }, now).items.length, 3);
});

test('membatasi ukuran halaman hingga 100 dan menangani parameter pagination invalid', () => {
  const users = Array.from({ length: 105 }, (_, index) => ({
    id: `user-${String(index).padStart(3, '0')}`,
    name: `Pengguna ${index}`,
    email: `user${index}@example.id`,
    createdAt: `2020-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
  }));

  const secondPage = buildAdminUserList(users, [], { page: '2', limit: '500' }, now);
  assert.equal(secondPage.items.length, 5);
  assert.deepEqual(secondPage.pagination, {
    page: 2, limit: 100, totalItems: 105, totalPages: 2,
    hasPreviousPage: true, hasNextPage: false,
  });

  const invalid = buildAdminUserList(users, [], { page: '-1', limit: '0' }, now);
  assert.equal(invalid.pagination.page, 1);
  assert.equal(invalid.pagination.limit, 10);
  assert.equal(invalid.items.length, 10);
});

test('menerima field snake_case, memakai zona waktu Jakarta, dan tidak memutasi input', () => {
  const users = [{
    id: 'u1', name: 'Sari', email: 'sari@example.id', password_hash: 'secret',
    onboarding_done: true, created_at: '2025-01-01T00:00:00.000Z',
  }];
  const transactions = [{
    id: 't1', user_id: 'u1', amount: 12_500, tanggal: '2026-08-17',
    created_at: '2026-08-17T17:30:00.000Z', updated_at: 'tanggal-invalid', sample: false,
  }];
  const usersBefore = structuredClone(users);
  const transactionsBefore = structuredClone(transactions);
  const jakartaNow = new Date('2026-08-18T16:30:00.000Z');

  const result = buildAdminUserList(users, transactions, null, jakartaNow);

  assert.equal(result.items[0].onboardingDone, true);
  assert.equal(result.items[0].lastActivityLabel, 'Hari ini');
  assert.equal(result.items[0].totalVolumeLabel, 'Rp 12.500');
  assert.deepEqual(users, usersBefore);
  assert.deepEqual(transactions, transactionsBefore);

  assert.deepEqual(buildAdminUserList(null, undefined, {}, now), {
    items: [],
    pagination: {
      page: 1, limit: 10, totalItems: 0, totalPages: 1,
      hasPreviousPage: false, hasNextPage: false,
    },
    summary: { total: 0, active: 0, inactive: 0, new: 0, totalTransactions: 0 },
  });
  assert.throws(() => buildAdminUserList([], [], {}, 'bukan-tanggal'), /tanggal yang valid/);
});
