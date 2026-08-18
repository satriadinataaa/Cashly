const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminAuth, resolveAdminConfig } = require('../api/admin/auth');

test('production mewajibkan secret dan password hash admin terpisah', () => {
  assert.throws(
    () => resolveAdminConfig({ NODE_ENV: 'production' }),
    /ADMIN_SESSION_SECRET/,
  );
  assert.throws(
    () => resolveAdminConfig({ NODE_ENV: 'production', ADMIN_SESSION_SECRET: 'secret' }),
    /ADMIN_PASSWORD_HASH/,
  );
});

test('sesi admin bertanda tangan dan memiliki masa kedaluwarsa', () => {
  let currentTime = Date.parse('2026-08-18T00:00:00Z');
  const auth = createAdminAuth({
    email: 'admin@test.id', name: 'Admin Test', password: 'password-admin',
    passwordHash: '', sessionSecret: 'secret-admin-test', secureCookie: false,
  }, () => currentTime);
  const token = auth.issueSession();
  assert.equal(auth.verifySession(token).role, 'super_admin');
  assert.equal(auth.verifySession(`${token}rusak`), null);
  currentTime += (8 * 60 * 60 + 1) * 1000;
  assert.equal(auth.verifySession(token), null);
});
