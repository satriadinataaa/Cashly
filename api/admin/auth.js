const crypto = require('node:crypto');

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function safeEqual(left, right) {
  const leftHash = crypto.createHash('sha256').update(String(left)).digest();
  const rightHash = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function resolveAdminConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  if (production && !env.ADMIN_SESSION_SECRET) {
    throw new Error('ADMIN_SESSION_SECRET wajib diisi pada production.');
  }
  return {
    sessionSecret: String(env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex')),
    secureCookie: production,
  };
}

function signature(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createAdminAuth(config, now = () => Date.now()) {
  function issueSession(admin) {
    const payload = Buffer.from(JSON.stringify({
      sub: String(admin.id),
      username: admin.username,
      name: admin.name,
      role: admin.role,
      exp: Math.floor(now() / 1000) + SESSION_TTL_SECONDS,
    })).toString('base64url');
    return `${payload}.${signature(payload, config.sessionSecret)}`;
  }

  function verifySession(token) {
    try {
      const [payload, providedSignature, extra] = String(token || '').split('.');
      if (!payload || !providedSignature || extra
          || !safeEqual(providedSignature, signature(payload, config.sessionSecret))) return null;
      const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (!session.sub || !session.username || !session.role
          || session.exp <= Math.floor(now() / 1000)) return null;
      return session;
    } catch {
      return null;
    }
  }

  const security = `HttpOnly; SameSite=Strict; Path=/api/admin${config.secureCookie ? '; Secure' : ''}`;
  return {
    issueSession,
    verifySession,
    sessionCookie: token => `cashly_admin_session=${token}; ${security}; Max-Age=${SESSION_TTL_SECONDS}`,
    clearCookie: () => `cashly_admin_session=; ${security}; Max-Age=0`,
  };
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

module.exports = { createAdminAuth, parseCookies, resolveAdminConfig, SESSION_TTL_SECONDS };
