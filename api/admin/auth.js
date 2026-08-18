const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

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
  if (production && !env.ADMIN_PASSWORD_HASH) {
    throw new Error('ADMIN_PASSWORD_HASH wajib diisi pada production.');
  }
  return {
    email: String(env.ADMIN_EMAIL || 'admin@cashly.id').trim().toLowerCase(),
    name: String(env.ADMIN_NAME || 'Admin Raya').trim(),
    passwordHash: String(env.ADMIN_PASSWORD_HASH || ''),
    password: String(env.ADMIN_PASSWORD || 'CashlyAdmin2026!'),
    sessionSecret: String(env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex')),
    secureCookie: production,
  };
}

function signature(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createAdminAuth(config, now = () => Date.now()) {
  async function authenticate(email, password) {
    const emailMatches = safeEqual(String(email || '').trim().toLowerCase(), config.email);
    const passwordMatches = config.passwordHash
      ? await bcrypt.compare(String(password || ''), config.passwordHash)
      : safeEqual(String(password || ''), config.password);
    return emailMatches && passwordMatches;
  }

  function issueSession() {
    const payload = Buffer.from(JSON.stringify({
      sub: 'cashly-admin',
      email: config.email,
      name: config.name,
      role: 'super_admin',
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
      if (session.sub !== 'cashly-admin' || session.role !== 'super_admin'
          || session.exp <= Math.floor(now() / 1000)) return null;
      return session;
    } catch {
      return null;
    }
  }

  const security = `HttpOnly; SameSite=Strict; Path=/api/admin${config.secureCookie ? '; Secure' : ''}`;
  return {
    authenticate,
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
