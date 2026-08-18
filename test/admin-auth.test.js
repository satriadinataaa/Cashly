const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clearSessionCookie, createAdminSession, hashSessionToken,
  resolveAdminConfig, sessionCookie,
} = require('../api/admin/auth');

test('production tidak membutuhkan session secret dari environment', () => {
  assert.deepEqual(resolveAdminConfig({ NODE_ENV: 'production' }), { secureCookie: true });
  assert.deepEqual(resolveAdminConfig({}), { secureCookie: false });
});

test('sesi admin memakai token acak dan hanya hash-nya yang disimpan', () => {
  const now = Date.parse('2026-08-18T00:00:00Z');
  const first = createAdminSession('admin-id', () => now);
  const second = createAdminSession('admin-id', () => now);

  assert.notEqual(first.token, second.token);
  assert.equal(first.record.adminId, 'admin-id');
  assert.equal(first.record.tokenHash, hashSessionToken(first.token));
  assert.notEqual(first.record.tokenHash, first.token);
  assert.equal(first.record.createdAt, '2026-08-18T00:00:00.000Z');
  assert.equal(first.record.expiresAt, '2026-08-18T08:00:00.000Z');
});

test('cookie sesi tetap terisolasi pada API admin', () => {
  assert.match(sessionCookie('token', true), /HttpOnly; SameSite=Strict; Path=\/api\/admin/);
  assert.match(sessionCookie('token', true), /; Secure/);
  assert.match(clearSessionCookie(false), /Max-Age=0/);
});
