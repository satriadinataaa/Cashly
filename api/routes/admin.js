const express = require('express');
const bcrypt = require('bcryptjs');
const {
  clearSessionCookie, createAdminSession, hashSessionToken,
  parseCookies, resolveAdminConfig, sessionCookie,
} = require('../admin/auth');
const {
  ADMIN_INSIGHT_KEYS,
  buildAdminInsightDetail,
  buildAdminInsights,
} = require('../services/admin-insights');
const { buildAdminReport } = require('../services/admin-reports');
const { buildAdminTransactionList } = require('../services/admin-transactions');
const { buildAdminUserList } = require('../services/admin-users');

const DUMMY_PASSWORD_HASH = '$2b$12$0XU8.j8mj9COULD6TI5O/OINMDcIfhNp/FNmefn5xdneALLrXT.3y';

function publicAdmin(admin) {
  return { id: admin.id, username: admin.username, name: admin.name, role: admin.role };
}

function requestOriginIsValid(req) {
  if (!req.headers.origin) return true;
  // Browser modern memberi sinyal ini berdasarkan URL publik sebelum request
  // melewati reverse proxy, sehingga tidak terpengaruh host internal proxy.
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'same-origin') return true;
  try {
    const origin = new URL(req.headers.origin);
    const first = value => String(value || '').split(',')[0].trim().toLowerCase();
    const allowedOrigins = String(process.env.ADMIN_ALLOWED_ORIGINS || '')
      .split(',').map(value => value.trim()).filter(Boolean);
    if (allowedOrigins.includes(origin.origin)) return true;

    const normalizeHostname = value => String(value || '').toLowerCase().replace(/^www\./, '');
    const parseAuthority = (value) => {
      const authority = first(value);
      if (!authority) return null;
      try {
        const parsed = new URL(`http://${authority}`);
        return { hostname: normalizeHostname(parsed.hostname), port: parsed.port };
      } catch {
        return null;
      }
    };
    const hosts = [
      parseAuthority(req.headers['x-forwarded-host']),
      parseAuthority(req.headers.host),
    ].filter(Boolean);
    const protocols = new Set([
      first(req.headers['x-forwarded-proto']),
      first(req.protocol),
    ].filter(Boolean));
    const originProtocol = origin.protocol.slice(0, -1).toLowerCase();
    const defaultPort = originProtocol === 'https' ? '443' : originProtocol === 'http' ? '80' : '';
    const originPort = origin.port || defaultPort;
    return protocols.has(originProtocol) && hosts.some(host => (
      host.hostname === normalizeHostname(origin.hostname)
      && (host.port || defaultPort) === originPort
    ));
  } catch {
    return false;
  }
}

function createLoginLimiter(now = () => Date.now()) {
  const attempts = new Map();
  return {
    blocked(key) {
      const entry = attempts.get(key);
      if (!entry || now() - entry.startedAt > 15 * 60_000) {
        attempts.delete(key);
        return false;
      }
      return entry.count >= 5;
    },
    failed(key) {
      const entry = attempts.get(key);
      if (!entry || now() - entry.startedAt > 15 * 60_000) {
        attempts.set(key, { count: 1, startedAt: now() });
      } else entry.count += 1;
    },
    clear(key) { attempts.delete(key); },
  };
}

function createAdminRouter(store, options = {}) {
  const router = express.Router();
  const config = options.config || resolveAdminConfig(options.env);
  const limiter = createLoginLimiter(options.now);

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/auth/login', async (req, res) => {
    if (!requestOriginIsValid(req)) return res.status(403).json({ message: 'Origin permintaan tidak valid.' });
    const limiterKey = req.ip || req.socket.remoteAddress || 'unknown';
    if (limiter.blocked(limiterKey)) {
      res.set('Retry-After', '900');
      return res.status(429).json({ message: 'Terlalu banyak percobaan. Coba kembali dalam 15 menit.' });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const username = String(body.username || '').trim().toLowerCase();
    const admin = username ? await store.findAdminByUsername(username) : null;
    const passwordMatches = await bcrypt.compare(
      String(body.password || ''), admin?.passwordHash || DUMMY_PASSWORD_HASH,
    );
    if (!admin || !admin.active || !passwordMatches) {
      limiter.failed(limiterKey);
      return res.status(401).json({ message: 'Username atau password admin tidak valid.' });
    }
    limiter.clear(limiterKey);
    const loggedInAdmin = await store.updateAdminLastLogin(admin.id) || admin;
    const session = createAdminSession(loggedInAdmin.id, options.now);
    await store.createAdminSession(session.record);
    res.set('Set-Cookie', sessionCookie(session.token, config.secureCookie));
    res.json({ user: publicAdmin(loggedInAdmin) });
  });

  router.post('/auth/logout', async (req, res) => {
    if (!requestOriginIsValid(req)) return res.status(403).json({ message: 'Origin permintaan tidak valid.' });
    const token = parseCookies(req.headers.cookie).cashly_admin_session;
    if (token) await store.deleteAdminSession(hashSessionToken(token));
    res.set('Set-Cookie', clearSessionCookie(config.secureCookie));
    res.json({ message: 'Sesi admin telah berakhir.' });
  });

  router.use(async (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.cashly_admin_session;
    if (!token) return res.status(401).json({ message: 'Autentikasi admin diperlukan.' });
    const admin = await store.findAdminBySessionTokenHash(hashSessionToken(token));
    if (!admin || !admin.active) return res.status(401).json({ message: 'Autentikasi admin diperlukan.' });
    req.admin = admin;
    next();
  });

  router.get('/session', (req, res) => {
    res.json({ user: publicAdmin(req.admin) });
  });

  router.get('/insights', async (req, res) => {
    const [users, transactions] = await Promise.all([
      store.listUsersForAdmin(),
      store.listTransactionsForAdmin(),
    ]);
    res.json(buildAdminInsights(users, transactions));
  });

  router.get('/insights/:key', async (req, res) => {
    if (!ADMIN_INSIGHT_KEYS.includes(req.params.key)) {
      return res.status(404).json({ message: 'Endpoint admin tidak ditemukan.' });
    }
    const [users, transactions] = await Promise.all([
      store.listUsersForAdmin(),
      store.listTransactionsForAdmin(),
    ]);
    res.json(buildAdminInsightDetail(req.params.key, users, transactions, req.query));
  });

  router.get('/users', async (req, res) => {
    const [users, transactions] = await Promise.all([
      store.listUsersForAdmin(),
      store.listTransactionsForAdmin(),
    ]);
    res.json(buildAdminUserList(users, transactions, req.query));
  });

  router.delete('/users/:id', async (req, res) => {
    if (!requestOriginIsValid(req)) return res.status(403).json({ message: 'Origin permintaan tidak valid.' });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return res.status(400).json({ message: 'ID pengguna tidak valid.' });
    }
    const deleted = await store.deleteUserForAdmin(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    res.json({
      message: `Pengguna dan ${deleted.deletedTransactions} transaksi berhasil dihapus.`,
      user: deleted,
    });
  });

  router.get('/transactions', async (req, res) => {
    const [users, transactions] = await Promise.all([
      store.listUsersForAdmin(),
      store.listTransactionsForAdmin(),
    ]);
    res.json(buildAdminTransactionList(users, transactions, req.query));
  });

  router.get('/reports', async (req, res) => {
    const [users, transactions] = await Promise.all([
      store.listUsersForAdmin(),
      store.listTransactionsForAdmin(),
    ]);
    res.json(buildAdminReport(users, transactions, req.query));
  });

  router.use((req, res) => res.status(404).json({ message: 'Endpoint admin tidak ditemukan.' }));

  return router;
}

module.exports = { createAdminRouter, createLoginLimiter, requestOriginIsValid };
