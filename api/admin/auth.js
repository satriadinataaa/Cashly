const crypto = require('node:crypto');

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function resolveAdminConfig(env = process.env) {
  return { secureCookie: env.NODE_ENV === 'production' };
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function createAdminSession(adminUserId, now = () => Date.now()) {
  const token = crypto.randomBytes(32).toString('base64url');
  const createdAt = new Date(now());
  return {
    token,
    record: {
      id: crypto.randomUUID(),
      adminId: adminUserId,
      tokenHash: hashSessionToken(token),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
    },
  };
}

function sessionCookie(token, secureCookie = false) {
  return `cashly_admin_session=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_TTL_SECONDS}${secureCookie ? '; Secure' : ''}`;
}

function clearSessionCookie(secureCookie = false) {
  return `cashly_admin_session=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${secureCookie ? '; Secure' : ''}`;
}

function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    cookies[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }
  return cookies;
}

module.exports = {
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  createAdminSession,
  hashSessionToken,
  parseCookies,
  resolveAdminConfig,
  sessionCookie,
};
