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
  assert.match(page.text, /id="metricDetailPage"/);
  assert.match(page.headers['cache-control'], /no-store/);

  const script = await request(app).get('/admin/src/main.js');
  assert.equal(script.status, 200);
  assert.match(script.text, /\/api\/admin/);
  assert.match(script.text, /router\.mjs/);

  const router = await request(app).get('/admin/src/router.mjs');
  assert.equal(router.status, 200);
  assert.match(router.text, /total-users/);
});

test('endpoint admin menolak akses anonim dan Bearer JWT pengguna', async () => {
  const anonymous = await request(app).get('/api/admin/insights');
  assert.equal(anonymous.status, 401);

  const anonymousDetail = await request(app).get('/api/admin/insights/total-users');
  assert.equal(anonymousDetail.status, 401);

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

  for (const metric of insights.body.metrics) {
    const detail = await agent.get(`/api/admin/insights/${metric.key}?limit=1`);
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.metric, metric);
    assert.deepEqual(detail.body.period, insights.body.period);
    assert.equal(detail.body.pagination.limit, 1);
    assert.equal(JSON.stringify(detail.body).includes('passwordHash'), false);
  }

  const unknownInsight = await agent.get('/api/admin/insights/tidak-ada');
  assert.equal(unknownInsight.status, 404);
  assert.equal(unknownInsight.body.message, 'Endpoint admin tidak ditemukan.');

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
  const proxied = await request(app).post('/api/admin/auth/login')
    .set('Host', 'cashly-internal:3000')
    .set('Origin', 'https://cashly.example')
    .set('X-Forwarded-Host', 'cashly.example')
    .set('X-Forwarded-Proto', 'https')
    .send({ username: 'admin', password: 'admin' });
  assert.equal(proxied.status, 200);

  const browserSameOrigin = await request(app).post('/api/admin/auth/login')
    .set('Origin', 'https://cashly-public.example')
    .set('Sec-Fetch-Site', 'same-origin')
    .send({ username: 'admin', password: 'admin' });
  assert.equal(browserSameOrigin.status, 200);

  const foreignLogin = await request(app).post('/api/admin/auth/login')
    .set('Origin', 'https://evil.example')
    .send({ username: 'admin', password: 'admin' });
  assert.equal(foreignLogin.status, 403);

  const aliasLogin = await request(app).post('/api/admin/auth/login')
    .set('Host', 'cashlymoneytracker.online')
    .set('Origin', 'https://www.cashlymoneytracker.online')
    .set('X-Forwarded-Proto', 'https')
    .send({ username: 'admin', password: 'admin' });
  assert.equal(aliasLogin.status, 200);

  const wrongPort = await request(app).post('/api/admin/auth/login')
    .set('Host', 'cashlymoneytracker.online')
    .set('Origin', 'https://cashlymoneytracker.online:4443')
    .set('X-Forwarded-Proto', 'https')
    .send({ username: 'admin', password: 'admin' });
  assert.equal(wrongPort.status, 403);

  const bodyWithoutJson = await request(app).post('/api/admin/auth/login')
    .set('Content-Type', 'text/plain')
    .send('username=admin&password=admin');
  assert.equal(bodyWithoutJson.status, 401);

  const agent = request.agent(app);
  await agent.post('/api/admin/auth/login').send({
    username: 'admin', password: 'admin',
  });
  const foreignLogout = await agent.post('/api/admin/auth/logout')
    .set('Origin', 'https://evil.example');
  assert.equal(foreignLogout.status, 403);

  const aliasAgent = request.agent(app);
  await aliasAgent.post('/api/admin/auth/login').send({
    username: 'admin', password: 'admin',
  });
  const aliasLogout = await aliasAgent.post('/api/admin/auth/logout')
    .set('Host', 'cashlymoneytracker.online')
    .set('Origin', 'https://www.cashlymoneytracker.online')
    .set('X-Forwarded-Proto', 'https');
  assert.equal(aliasLogout.status, 200);

  const logout = await agent.post('/api/admin/auth/logout');
  assert.equal(logout.status, 200);
  assert.match(logout.headers['set-cookie'][0], /Max-Age=0/);
  assert.equal((await agent.get('/api/admin/session')).status, 401);
});
