const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { newDb } = require('pg-mem');

process.env.JWT_SECRET = 'test-secret-only';
const { createApp } = require('../src/app');
const { migrate } = require('../src/database');
const { createStore } = require('../src/store');
const memoryDb = newDb();
const { Pool } = memoryDb.adapters.createPg();
const pool = new Pool();
const sentVerificationEmails = [];
const app = createApp(createStore(pool), { mailer: { sendVerification: async email => sentVerificationEmails.push(email) } });

async function registerAndVerify(path, payload) {
  const registered = await request(app).post(`${path}/auth/register`).send(payload);
  assert.equal(registered.status, 201);
  assert.match(registered.body.verificationToken, /^[a-f0-9]{64}$/);
  assert.match(registered.body.message, /Spam|Junk/);
  assert.equal(registered.body.token, undefined);
  assert.equal(registered.body.user, undefined);
  const pendingLogin = await request(app).post(`${path}/auth/login`).send({ email: payload.email, password: payload.password });
  assert.equal(pendingLogin.status, 403);
  const verified = await request(app).post(`${path}/auth/verify-email`).send({ token: registered.body.verificationToken });
  assert.equal(verified.status, 200);
  const login = await request(app).post(`${path}/auth/login`).send({ email: payload.email, password: payload.password });
  assert.equal(login.body.user.emailVerified, true);
  return login;
}

test.before(async () => migrate(pool));

test('register membuat user baru dengan arus kas kosong', async () => {
  const res = await registerAndVerify('/api', { name:'Rani Test', email:'rani@test.id', password:'passwordku' });
  assert.equal(res.status, 200); assert.ok(res.body.token); assert.equal(res.body.user.email, 'rani@test.id');
  assert.equal(sentVerificationEmails[0].email, 'rani@test.id');
  const rows = await request(app).get('/api/transactions').set('Authorization', `Bearer ${res.body.token}`);
  assert.equal(rows.status, 200); assert.equal(rows.body.length, 0);
});

test('login gagal dengan password keliru', async () => {
  const res = await request(app).post('/api/auth/login').send({ email:'rani@test.id', password:'salahbanget' });
  assert.equal(res.status, 401);
});

test('password dapat direset dengan token sekali pakai', async () => {
  const requested = await request(app).post('/api/auth/forgot-password').send({ email:'rani@test.id' });
  assert.equal(requested.status, 200);
  assert.match(requested.body.resetToken, /^[a-f0-9]{64}$/);

  const reset = await request(app).post('/api/auth/reset-password').send({
    token: requested.body.resetToken,
    password: 'password-baru',
  });
  assert.equal(reset.status, 200);

  const reused = await request(app).post('/api/auth/reset-password').send({
    token: requested.body.resetToken,
    password: 'password-lain',
  });
  assert.equal(reused.status, 400);
  const oldLogin = await request(app).post('/api/auth/login').send({ email:'rani@test.id', password:'passwordku' });
  assert.equal(oldLogin.status, 401);
  const newLogin = await request(app).post('/api/auth/login').send({ email:'rani@test.id', password:'password-baru' });
  assert.equal(newLogin.status, 200);
});

test('transaksi dapat ditambah, diubah, dan dihapus', async () => {
  const login = await request(app).post('/api/auth/login').send({ email:'rani@test.id', password:'password-baru' });
  const auth = { Authorization:`Bearer ${login.body.token}` };
  const invalid = await request(app).post('/api/transactions').set(auth).send({ nominal:-1 });
  assert.equal(invalid.status, 400);
  const created = await request(app).post('/api/transactions').set(auth).send({ tanggal:'2026-08-11', tipe:'operasi', tujuan:'Kebutuhan sehari-hari', arah:'keluar', kategori:'Makan & Minum', deskripsi:'Kopi', nominal:25000 });
  assert.equal(created.status, 201); assert.equal(created.body.tujuan, 'Kebutuhan sehari-hari');
  const updated = await request(app).put(`/api/transactions/${created.body.id}`).set(auth).send({ ...created.body, nominal:30000 });
  assert.equal(updated.status, 200); assert.equal(updated.body.nominal, 30000);
  const removed = await request(app).delete(`/api/transactions/${created.body.id}`).set(auth);
  assert.equal(removed.status, 204);
  const rows = await request(app).get('/api/transactions').set(auth);
  assert.equal(rows.body.length, 0);
});

test('beberapa transaksi dapat disimpan sekaligus', async () => {
  const login = await request(app).post('/api/auth/login').send({ email:'rani@test.id', password:'password-baru' });
  const auth = { Authorization:`Bearer ${login.body.token}` };
  const transactions = [
    { tanggal:'2026-08-18', tipe:'operasi', tujuan:'Pekerjaan & usaha', arah:'masuk', kategori:'Bonus', deskripsi:'Bonus proyek', nominal:500000 },
    { tanggal:'2026-08-18', tipe:'operasi', tujuan:'Kebutuhan sehari-hari', arah:'keluar', kategori:'Transportasi Umum', deskripsi:'Kereta', nominal:25000 },
  ];
  const created = await request(app).post('/api/transactions/bulk').set(auth).send({ transactions });
  assert.equal(created.status, 201);assert.equal(created.body.length, 2);assert.equal(created.body[0].kategori, 'Bonus');
  const invalid = await request(app).post('/api/transactions/bulk').set(auth).send({ transactions:[transactions[0],{ ...transactions[1], nominal:0 }] });
  assert.equal(invalid.status, 400);assert.match(invalid.body.message, /Transaksi 2/);
  for (const row of created.body) await request(app).delete(`/api/transactions/${row.id}`).set(auth);
});

test('arus kas terisolasi untuk setiap user', async () => {
  const firstLogin = await request(app).post('/api/auth/login').send({ email:'rani@test.id', password:'password-baru' });
  const firstAuth = { Authorization:`Bearer ${firstLogin.body.token}` };
  await request(app).post('/api/transactions').set(firstAuth).send({ tanggal:'2026-08-11', tipe:'operasi', arah:'masuk', kategori:'Gaji', deskripsi:'Milik Rani', nominal:5000000 });

  const second = await registerAndVerify('/api', { name:'Dimas Test', email:'dimas@test.id', password:'passwordku' });
  const secondAuth = { Authorization:`Bearer ${second.body.token}` };
  const secondRows = await request(app).get('/api/transactions').set(secondAuth);
  assert.equal(secondRows.status, 200);
  assert.equal(secondRows.body.length, 0);

  const firstRows = await request(app).get('/api/transactions').set(firstAuth);
  assert.equal(firstRows.body.length, 1);
  assert.equal(firstRows.body[0].deskripsi, 'Milik Rani');
});

test('endpoint transaksi wajib autentikasi', async () => {
  const res = await request(app).get('/api/transactions');
  assert.equal(res.status, 401);
});

test('asset aplikasi tidak menggunakan cache browser lama', async () => {
  for (const path of ['/', '/app.js', '/styles.css']) {
    const response = await request(app).get(path);
    assert.equal(response.status, 200);
    assert.match(response.headers['cache-control'], /no-store/);
    assert.equal(response.headers.pragma, 'no-cache');
  }
});

test('summary API memisahkan investment dari expense dan mempertahankan net worth', async () => {
  const registered = await registerAndVerify('/api', { name:'Accounting Test', email:'accounting@test.id', password:'passwordku' });
  const auth = { Authorization:`Bearer ${registered.body.token}` };
  await request(app).post('/api/transactions').set(auth).send({ tanggal:'2026-08-13', tipe:'operasi', jenis:'income', arah:'masuk', kategori:'Gaji', nominal:25_000_000 });
  const investment = await request(app).post('/api/transactions').set(auth).send({ tanggal:'2026-08-13', tipe:'investasi', jenis:'investment', arah:'keluar', kategori:'Pembelian Reksadana', nominal:5_400_000, assetId:'portfolio' });
  assert.equal(investment.status, 201); assert.equal(investment.body.assetId, 'portfolio');
  const summary = await request(app).get('/api/summary').set(auth);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.cashBalance, 19_600_000); assert.equal(summary.body.income, 25_000_000);
  assert.equal(summary.body.expense, 0); assert.equal(summary.body.investment, 5_400_000);
  assert.equal(summary.body.cashOutflow, 5_400_000); assert.equal(summary.body.totalAssets, 25_000_000); assert.equal(summary.body.netWorth, 25_000_000);
});

test('transfer API mewajibkan rekening sumber dan tujuan', async () => {
  const login = await request(app).post('/api/auth/login').send({ email:'accounting@test.id', password:'passwordku' });
  const res = await request(app).post('/api/transactions').set('Authorization', `Bearer ${login.body.token}`).send({ tanggal:'2026-08-13', tipe:'operasi', jenis:'transfer', arah:'keluar', kategori:'Transfer', nominal:5_000_000 });
  assert.equal(res.status, 400);
});

test('API v1 menyediakan health check dan katalog transaksi untuk mobile', async () => {
  const health = await request(app).get('/api/v1/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  const catalog = await request(app).get('/api/v1/catalog');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.types.length, 3);
  assert.ok(catalog.body.types[0].purposes[0].categories.keluar.length > 0);
  assert.deepEqual(catalog.body.constraints.transferRequiredFields, ['akunSumber', 'akunTujuan']);
});

test('API v1 mendukung detail, patch, dan pagination transaksi mobile', async () => {
  const registered = await registerAndVerify('/api/v1', {
    name: 'Mobile Test', email: 'mobile@test.id', password: 'passwordku',
  });
  const auth = { Authorization: `Bearer ${registered.body.token}` };
  const payloads = [
    { tanggal:'2026-08-18', tipe:'operasi', jenis:'income', arah:'masuk', kategori:'Gaji', nominal:10_000_000 },
    { tanggal:'2026-08-18', tipe:'operasi', jenis:'expense', arah:'keluar', kategori:'Makan & Minum', nominal:1_000_000 },
    { tanggal:'2026-08-17', tipe:'investasi', jenis:'investment', arah:'keluar', kategori:'Pembelian Emas', nominal:2_000_000, assetId:'gold' },
  ];
  const created = [];
  for (const payload of payloads) created.push(await request(app).post('/api/v1/transactions').set(auth).send(payload));
  const detail = await request(app).get(`/api/v1/transactions/${created[1].body.id}`).set(auth);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.kategori, 'Makan & Minum');
  const patched = await request(app).patch(`/api/v1/transactions/${created[1].body.id}`).set(auth).send({ nominal:1_250_000 });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.nominal, 1_250_000);
  const page = await request(app).get('/api/v1/transactions?limit=2&page=1').set(auth);
  assert.equal(page.status, 200);
  assert.equal(page.body.length, 2);
  assert.equal(page.headers['x-total-count'], '3');
  assert.equal(page.headers['x-has-more'], 'true');
});

test('API dashboard dan laporan mobile dihitung di server serta terisolasi', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email:'mobile@test.id', password:'passwordku' });
  const auth = { Authorization: `Bearer ${login.body.token}` };
  const dashboard = await request(app).get('/api/v1/dashboard?period=all&timezone=Asia/Jakarta').set(auth);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.counts.total, 3);
  assert.equal(dashboard.body.flow.income, 10_000_000);
  assert.equal(dashboard.body.flow.expense, 1_250_000);
  assert.equal(dashboard.body.flow.investment, 2_000_000);
  assert.equal(dashboard.body.lifetime.cashBalance, 6_750_000);
  assert.equal(dashboard.body.expenses.byCategory[0].category, 'Makan & Minum');
  assert.equal(dashboard.body.trend.length, 2);
  const report = await request(app).get('/api/v1/reports/cash-flow?start=2026-08-17&end=2026-08-18').set(auth);
  assert.equal(report.status, 200);
  assert.equal(report.body.activities.length, 3);
  assert.equal(report.body.totals.net, 6_750_000);
  const unauthorized = await request(app).get('/api/v1/dashboard?period=all');
  assert.equal(unauthorized.status, 401);
});

test.after(async () => pool.end());
