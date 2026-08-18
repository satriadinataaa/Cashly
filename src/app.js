const express = require('express');
const path = require('node:path');
const helmet = require('helmet');
const { createApiRouter } = require('../api');
const { createAdminRouter } = require('../api/routes/admin');

function createApp(store) {
  if (!store) throw new Error('Store PostgreSQL wajib diberikan ke createApp().');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb' }));

  // Autentikasi admin sengaja dipisahkan dari JWT pengguna dan harus dipasang
  // sebelum router /api generik yang mewajibkan Bearer token pengguna.
  app.use('/api/admin', createAdminRouter(store));

  // /api dipertahankan untuk web; /api/v1 menjadi kontrak stabil untuk aplikasi mobile.
  app.use('/api/v1', createApiRouter(store));
  app.use('/api', createApiRouter(store));

  app.use((req, res, next) => {
    if (/\.(?:html|js|css)$/i.test(req.path) || req.path === '/') {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });
    }
    next();
  });
  const adminDirectory = path.join(__dirname, '..', 'admin');
  app.get(/^\/admin$/, (req, res) => res.redirect(308, '/admin/'));
  app.use('/admin', (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    next();
  });
  app.use('/admin', express.static(adminDirectory));
  app.get('/admin/{*splat}', (req, res) => res.sendFile(path.join(adminDirectory, 'index.html')));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/{*splat}', (req, res, next) => (
    req.path.startsWith('/api/') ? next() : res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
  ));
  app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  });
  return app;
}

module.exports = { createApp };
