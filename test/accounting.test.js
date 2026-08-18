const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize, transactionKind } = require('../src/accounting');

const tx = (jenis, arah, nominal, extra = {}) => ({ jenis, arah, nominal, tipe: jenis === 'investment' ? 'investasi' : 'operasi', ...extra });

test('income menambah kas dan income, bukan expense', () => {
  const result = summarize([tx('income', 'masuk', 25_000_000)]);
  assert.deepEqual({ cash: result.cashBalance, income: result.income, expense: result.expense }, { cash: 25_000_000, income: 25_000_000, expense: 0 });
});

test('expense mengurangi kas tanpa menambah asset', () => {
  const result = summarize([tx('expense', 'keluar', 1_000_000)], { openingCash: 1_000_000 });
  assert.equal(result.cashBalance, 0); assert.equal(result.expense, 1_000_000); assert.equal(result.assetBookValue, 0);
});

test('salary dan expense menghasilkan cash serta net worth setelah konsumsi', () => {
  const result = summarize([
    tx('income', 'masuk', 25_000_000),
    tx('expense', 'keluar', 1_000_000)
  ]);
  assert.equal(result.cashBalance, 24_000_000);
  assert.equal(result.income, 25_000_000); assert.equal(result.expense, 1_000_000);
  assert.equal(result.totalAssets, 24_000_000); assert.equal(result.netWorth, 24_000_000);
});

test('investment terkait asset mengubah komposisi asset, bukan expense atau net worth', () => {
  const result = summarize([
    tx('income', 'masuk', 25_000_000),
    tx('investment', 'keluar', 5_400_000, { assetId: 'rumah' })
  ]);
  assert.equal(result.cashBalance, 19_600_000);
  assert.equal(result.income, 25_000_000); assert.equal(result.expense, 0);
  assert.equal(result.investment, 5_400_000); assert.equal(result.cashOutflow, 5_400_000);
  assert.equal(result.assets.rumah, 5_400_000); assert.equal(result.totalAssets, 25_000_000); assert.equal(result.netWorth, 25_000_000);
});

test('investment tanpa target tetap allocation tetapi tidak membuat asset otomatis', () => {
  const result = summarize([tx('investment', 'keluar', 5_400_000)], { openingCash: 10_000_000 });
  assert.equal(result.investment, 5_400_000); assert.equal(result.expense, 0); assert.equal(result.assetBookValue, 0);
});

test('salary, expense, dan linked investment tidak menduplikasi atau mengurangi wealth dua kali', () => {
  const result = summarize([
    tx('income', 'masuk', 25_000_000),
    tx('expense', 'keluar', 1_000_000),
    tx('investment', 'keluar', 5_400_000, { assetId: 'portfolio' })
  ]);
  assert.equal(result.cashBalance, 18_600_000);
  assert.equal(result.income, 25_000_000); assert.equal(result.expense, 1_000_000);
  assert.equal(result.investment, 5_400_000); assert.equal(result.assets.portfolio, 5_400_000);
  assert.equal(result.totalAssets, 24_000_000); assert.equal(result.netWorth, 24_000_000);
});

test('transfer dan saving memindahkan rekening tanpa mengubah kas konsolidasi atau net worth', () => {
  const result = summarize([
    tx('transfer', 'keluar', 5_000_000, { akunSumber: 'bank-a', akunTujuan: 'bank-b' }),
    tx('saving', 'keluar', 3_000_000, { akunSumber: 'bank-b', akunTujuan: 'saving' })
  ], { openingCash: 10_000_000, openingAccounts: { 'bank-a': 10_000_000 } });
  assert.deepEqual(result.accounts, { 'bank-a': 5_000_000, 'bank-b': 2_000_000, saving: 3_000_000 });
  assert.equal(result.cashBalance, 10_000_000); assert.equal(result.income, 0); assert.equal(result.expense, 0); assert.equal(result.netWorth, 10_000_000);
});

test('debt payment terkait liability mengurangi kas dan liability', () => {
  const result = summarize([tx('debt_payment', 'keluar', 2_000_000, { liabilityId: 'kpr' })], { openingCash: 10_000_000, openingLiabilities: 8_000_000 });
  assert.equal(result.cashBalance, 8_000_000); assert.equal(result.totalLiabilities, 6_000_000); assert.equal(result.expense, 0); assert.equal(result.netWorth, 2_000_000);
});

test('transaksi historis tetap diklasifikasikan tanpa rewrite data', () => {
  assert.equal(transactionKind({ tipe: 'investasi', arah: 'keluar' }), 'investment');
  assert.equal(transactionKind({ tipe: 'operasi', arah: 'keluar' }), 'expense');
  assert.equal(transactionKind({ tipe: 'operasi', arah: 'masuk' }), 'income');
});
