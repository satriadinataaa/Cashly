const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { newDb } = require('pg-mem');

const { createApp } = require('../src/app');
const { migrate } = require('../src/database');
const { createStore } = require('../src/store');

const memoryDb = newDb();
const { Pool } = memoryDb.adapters.createPg();
const pool = new Pool();
const app = createApp(createStore(pool));

test.before(async () => migrate(pool));
test.after(async () => pool.end());

test('halaman admin tersedia pada /admin di aplikasi utama', async () => {
  const canonical = await request(app).get('/admin');
  assert.equal(canonical.status, 308);
  assert.equal(canonical.headers.location, '/admin/');

  const page = await request(app).get('/admin/');
  assert.equal(page.status, 200);
  assert.match(page.text, /Cashly Admin/);
  assert.match(page.text, /id="loginForm"/);
  assert.match(page.headers['cache-control'], /no-store/);

  const script = await request(app).get('/admin/src/main.js');
  assert.equal(script.status, 200);
  assert.match(script.text, /\/api\/admin/);
});

test('endpoint admin menolak akses anonim dan Bearer JWT pengguna', async () => {
  const anonymous = await request(app).get('/api/admin/insights');
  assert.equal(anonymous.status, 401);

  const registered = await request(app).post('/api/auth/register').send({
    name: 'User Biasa', email: 'user-biasa@test.id', password: 'passwordku',
  });
  const userJwt = registered.body.token;
  const withUserJwt = await request(app).get('/api/admin/insights')
    .set('Authorization', `Bearer ${userJwt}`);
  assert.equal(withUserJwt.status, 401);
});

test('login admin menggunakan cookie terpisah dan dapat membuka insight global', async () => {
  const agent = request.agent(app);
  const invalid = await agent.post('/api/admin/auth/login').send({
    username: 'admin', password: 'password-salah',
  });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.headers['set-cookie'], undefined);

  const login = await agent.post('/api/admin/auth/login').send({
    username: 'admin', password: 'admin',
  });
  assert.equal(login.status, 200);
  const cookie = login.headers['set-cookie'][0];
  assert.match(cookie, /^cashly_admin_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/admin/);

  const session = await agent.get('/api/admin/session');
  assert.equal(session.status, 200);
  assert.equal(session.body.user.role, 'super_admin');
  assert.equal(session.body.user.username, 'admin');

  const insights = await agent.get('/api/admin/insights');
  assert.equal(insights.status, 200);
  assert.equal(insights.body.metrics.length, 4);

  const users = await agent.get('/api/admin/users?limit=10');
  assert.equal(users.status, 200);
  assert.ok(users.body.items.some((user) => user.email === 'user-biasa@test.id'));
  assert.equal(users.body.items.some((user) => 'passwordHash' in user), false);
  assert.equal(users.body.pagination.totalItems, 1);

  const searchedUsers = await agent.get('/api/admin/users?q=user-biasa&status=new');
  assert.equal(searchedUsers.status, 200);
  assert.equal(searchedUsers.body.items[0].email, 'user-biasa@test.id');

  const unknown = await agent.get('/api/admin/tidak-ada');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.message, 'Endpoint admin tidak ditemukan.');

  const userEndpoint = await agent.get('/api/transactions');
  assert.equal(userEndpoint.status, 401);
});

test('logout mengakhiri sesi admin dan origin asing ditolak', async () => {
  const forbidden = await request(app).post('/api/admin/auth/login')
    .set('Origin', 'https://evil.example')
    .send({ username: 'admin', password: 'admin' });
  assert.equal(forbidden.status, 403);

  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({
    username: 'admin', password: 'admin',
  });
  const logout = await agent.post('/api/admin/auth/logout');
  assert.equal(logout.status, 200);
  assert.match(logout.headers['set-cookie'][0], /Max-Age=0/);
  assert.equal((await agent.get('/api/admin/session')).status, 401);
});
