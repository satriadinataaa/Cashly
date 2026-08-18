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
const app = createApp(createStore(pool));

test.before(async () => migrate(pool));

test('register membuat user baru dengan arus kas kosong', async () => {
  const res = await request(app).post('/api/auth/register').send({ name:'Rani Test', email:'rani@test.id', password:'passwordku' });
  assert.equal(res.status, 201); assert.ok(res.body.token); assert.equal(res.body.user.email, 'rani@test.id');
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

test('arus kas terisolasi untuk setiap user', async () => {
  const firstLogin = await request(app).post('/api/auth/login').send({ email:'rani@test.id', password:'password-baru' });
  const firstAuth = { Authorization:`Bearer ${firstLogin.body.token}` };
  await request(app).post('/api/transactions').set(firstAuth).send({ tanggal:'2026-08-11', tipe:'operasi', arah:'masuk', kategori:'Gaji', deskripsi:'Milik Rani', nominal:5000000 });

  const second = await request(app).post('/api/auth/register').send({ name:'Dimas Test', email:'dimas@test.id', password:'passwordku' });
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

test('summary API memisahkan investment dari expense dan mempertahankan net worth', async () => {
  const registered = await request(app).post('/api/auth/register').send({ name:'Accounting Test', email:'accounting@test.id', password:'passwordku' });
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

test.after(async () => pool.end());
