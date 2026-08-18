const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePeriod, calculateStreak } = require('../api/services/analytics');

test('period month menggunakan timezone aplikasi', () => {
  const period = resolvePeriod(
    { period: 'month', timezone: 'Asia/Jakarta' },
    new Date('2026-08-31T18:00:00.000Z'),
  );
  assert.deepEqual(period, {
    preset: 'month', start: '2026-09-01', end: '2026-09-01', timezone: 'Asia/Jakarta',
  });
});

test('custom period menolak rentang terbalik dan timezone invalid', () => {
  assert.throws(() => resolvePeriod({ start:'2026-08-20', end:'2026-08-10' }), /start tidak boleh/);
  assert.throws(() => resolvePeriod({ timezone:'Mars\/Olympus' }), /Timezone tidak valid/);
});

test('streak menghitung tanggal berurutan dari transaksi terbaru', () => {
  const rows = [
    { tanggal:'2026-08-18' }, { tanggal:'2026-08-18' },
    { tanggal:'2026-08-17' }, { tanggal:'2026-08-16' }, { tanggal:'2026-08-14' },
  ];
  assert.deepEqual(calculateStreak(rows), { days:3, lastLoggedDate:'2026-08-18' });
});
