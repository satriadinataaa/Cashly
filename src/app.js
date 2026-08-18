const express = require('express');
const path = require('node:path');
const helmet = require('helmet');
const { createApiRouter } = require('../api');

function createApp(store) {
  if (!store) throw new Error('Store PostgreSQL wajib diberikan ke createApp().');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb' }));

  // /api dipertahankan untuk web; /api/v1 menjadi kontrak stabil untuk aplikasi mobile.
  app.use('/api/v1', createApiRouter(store));
  app.use('/api', createApiRouter(store));

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
