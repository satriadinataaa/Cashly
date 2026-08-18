const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminInsights } = require('../api/services/admin-insights');

const now = new Date('2026-08-18T05:00:00.000Z');

function transaction(id, userId, tanggal, arah, nominal, extra = {}) {
  return {
    id,
    userId,
    tanggal,
    arah,
    nominal,
    tipe: 'operasi',
    kategori: arah === 'masuk' ? 'Gaji' : 'Makan & Minum',
    createdAt: `${tanggal}T03:00:00.000Z`,
    sample: false,
    ...extra,
  };
}

test('menghasilkan metrik, pertumbuhan, dan periode dari agregat aplikasi', () => {
  const users = [
    { id: 'u1', name: 'Ari', createdAt: '2026-06-10T02:00:00.000Z' },
    { id: 'u2', name: 'Bela', createdAt: '2026-07-10T02:00:00.000Z' },
    { id: 'u3', name: 'Citra', createdAt: '2026-08-02T02:00:00.000Z' },
    { id: 'u4', name: 'Deni', createdAt: '2026-08-03T02:00:00.000Z' },
    { id: 'u4', name: 'Duplikat', createdAt: '2026-08-03T02:00:00.000Z' },
    { id: 'u5', name: 'Masa depan', createdAt: '2026-09-01T02:00:00.000Z' },
  ];
  const transactions = [
    transaction('p1', 'u1', '2026-07-02', 'masuk', 1_000),
    transaction('p2', 'u1', '2026-07-03', 'keluar', 1_000),
    transaction('c1', 'u1', '2026-08-01', 'masuk', 1_000),
    transaction('c2', 'u1', '2026-08-02', 'keluar', 600),
    transaction('c3', 'u3', '2026-08-03', 'masuk', 1_000),
    transaction('c4', 'u3', '2026-08-04', 'keluar', 900, { kategori: 'Transportasi' }),
    transaction('c5', 'u4', '2026-08-05', 'keluar', 500),
    transaction('c6', 'u4', '2026-08-06', 'keluar', 200, { jenis: 'transfer', kategori: 'Transfer' }),
  ];

  const result = buildAdminInsights(users, transactions, now);

  assert.deepEqual(result.period, {
    start: '2026-08-01',
    end: '2026-08-18',
    previousStart: '2026-07-01',
    previousEnd: '2026-07-18',
    label: '01–18 Agustus 2026',
    timezone: 'Asia/Jakarta',
  });
  assert.deepEqual(result.metrics.map(({ value, trend, note }) => ({ value, trend, note })), [
    { value: '4', trend: '+100%', note: 'vs. bulan lalu' },
    { value: '3', trend: '+200%', note: '75% dari total' },
    { value: '6', trend: '+200%', note: 'bulan ini' },
    { value: 'Rp 4,2 Rb', trend: '+110%', note: 'bulan ini' },
  ]);
  assert.deepEqual(result.growth.labels, ['Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu']);
  assert.deepEqual(result.growth.active, [0, 0, 0, 0, 0, 1, 3]);
  assert.deepEqual(result.growth.newUsers, [0, 0, 0, 0, 1, 1, 2]);
});

test('mengelompokkan kesehatan cash flow dan kategori pengeluaran tanpa transfer internal', () => {
  const users = [
    { id: 'sehat', name: 'Sehat', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'perhatian', name: 'Perhatian', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'risiko', name: 'Risiko', createdAt: '2026-01-01T00:00:00.000Z' },
  ];
  const transactions = [
    transaction('1', 'sehat', '2026-08-01', 'masuk', 1_000),
    transaction('2', 'sehat', '2026-08-02', 'keluar', 600),
    transaction('3', 'perhatian', '2026-08-03', 'masuk', 1_000),
    transaction('4', 'perhatian', '2026-08-04', 'keluar', 900, { kategori: 'Transportasi' }),
    transaction('5', 'risiko', '2026-08-05', 'keluar', 500),
    transaction('6', 'risiko', '2026-08-06', 'keluar', 200, { jenis: 'transfer', kategori: 'Transfer' }),
  ];

  const result = buildAdminInsights(users, transactions, now);

  assert.deepEqual(result.health.map(({ label, value, count }) => ({ label, value, count })), [
    { label: 'Sehat', value: 34, count: '1' },
    { label: 'Perlu perhatian', value: 33, count: '1' },
    { label: 'Berisiko', value: 33, count: '1' },
  ]);
  assert.deepEqual(result.categories, [
    {
      name: 'Makan & Minum', icon: 'food', color: '#2f8060',
      amount: 'Rp 1,1 Rb', count: '2 transaksi', percent: 55,
    },
    {
      name: 'Transportasi', icon: 'car', color: '#638bb1',
      amount: 'Rp 900', count: '1 transaksi', percent: 45,
    },
  ]);
});

test('aman untuk data kosong, invalid, transaksi contoh, dan tidak memutasi input', () => {
  const users = [{ id: 'u1', name: 'Ari', createdAt: 'tanggal-invalid' }];
  const transactions = [
    transaction('sample', 'u1', '2026-08-04', 'keluar', 50_000, { sample: true }),
    transaction('invalid-date', 'u1', '2026-02-30', 'keluar', 10_000),
    transaction('future', 'u1', '2026-08-19', 'keluar', Number.NaN),
  ];
  const usersBefore = structuredClone(users);
  const transactionsBefore = structuredClone(transactions);

  const result = buildAdminInsights(users, transactions, now);

  assert.deepEqual(result.metrics.map((metric) => metric.value), ['1', '0', '0', 'Rp 0']);
  assert.equal(result.metrics.every((metric) => !/NaN|Infinity/.test(`${metric.value}${metric.trend}`)), true);
  assert.deepEqual(result.health.map((item) => item.value), [0, 0, 0]);
  assert.deepEqual(result.categories, []);
  assert.deepEqual(buildAdminInsights(null, undefined, now).activities, []);
  assert.deepEqual(users, usersBefore);
  assert.deepEqual(transactions, transactionsBefore);
  assert.throws(() => buildAdminInsights([], [], 'bukan-tanggal'), /tanggal yang valid/);
});

test('menggunakan pergantian tanggal Asia/Jakarta dan menyajikan aktivitas terbaru', () => {
  const jakartaSeptember = new Date('2026-08-31T18:00:00.000Z');
  const result = buildAdminInsights(
    [{ id: 'u1', name: 'Ari', createdAt: '2026-08-31T17:15:00.000Z' }],
    [transaction('t1', 'u1', '2026-09-01', 'masuk', 2_500_000, {
      kategori: 'Gaji', createdAt: '2026-08-31T17:30:00.000Z',
    })],
    jakartaSeptember,
  );

  assert.equal(result.period.start, '2026-09-01');
  assert.equal(result.period.end, '2026-09-01');
  assert.equal(result.period.previousEnd, '2026-08-01');
  assert.equal(result.growth.labels.at(-1), 'Sep');
  assert.deepEqual(result.growth.newUsers.slice(-2), [0, 1]);
  assert.deepEqual(result.activities[0], {
    icon: 'wallet', tone: 'green', title: 'Pemasukan baru tercatat',
    text: 'Ari mencatat Gaji senilai Rp 2,5 Jt', time: '30 menit lalu',
  });
});
