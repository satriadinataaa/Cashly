const express = require('express');
const { createAdminAuth, parseCookies, resolveAdminConfig } = require('../admin/auth');
const { buildAdminInsights } = require('../services/admin-insights');
const { buildAdminUserList } = require('../services/admin-users');

function requestOriginIsValid(req) {
  if (!req.headers.origin) return true;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return req.headers.origin === `${protocol}://${req.headers.host}`;
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
  const auth = createAdminAuth(config, options.now);
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
    if (!(await auth.authenticate(req.body.email, req.body.password))) {
      limiter.failed(limiterKey);
      return res.status(401).json({ message: 'Email atau password admin tidak valid.' });
    }
    limiter.clear(limiterKey);
    res.set('Set-Cookie', auth.sessionCookie(auth.issueSession()));
    res.json({ user: { email: config.email, name: config.name, role: 'super_admin' } });
  });

  router.post('/auth/logout', (req, res) => {
    if (!requestOriginIsValid(req)) return res.status(403).json({ message: 'Origin permintaan tidak valid.' });
    res.set('Set-Cookie', auth.clearCookie());
    res.json({ message: 'Sesi admin telah berakhir.' });
  });

  router.use((req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const session = auth.verifySession(cookies.cashly_admin_session);
    if (!session) return res.status(401).json({ message: 'Autentikasi admin diperlukan.' });
    req.admin = session;
    next();
  });

  router.get('/session', (req, res) => {
    res.json({ user: { email: req.admin.email, name: req.admin.name, role: req.admin.role } });
  });

  router.get('/insights', async (req, res) => {
    const [users, transactions] = await Promise.all([
      store.listUsersForAdmin(),
      store.listTransactionsForAdmin(),
    ]);
    res.json(buildAdminInsights(users, transactions));
  });

  router.get('/users', async (req, res) => {
    const [users, transactions] = await Promise.all([
      store.listUsersForAdmin(),
      store.listTransactionsForAdmin(),
    ]);
    res.json(buildAdminUserList(users, transactions, req.query));
  });

  router.use((req, res) => res.status(404).json({ message: 'Endpoint admin tidak ditemukan.' }));

  return router;
}

module.exports = { createAdminRouter, createLoginLimiter, requestOriginIsValid };
