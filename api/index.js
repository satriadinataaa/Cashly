const express = require('express');
const { createAuthMiddleware } = require('./middleware/auth');
const { createAuthRouter } = require('./routes/auth');
const { createUsersRouter } = require('./routes/users');
const { createTransactionsRouter } = require('./routes/transactions');
const { createAnalyticsRouter } = require('./routes/analytics');
const { createCatalogRouter } = require('./routes/catalog');

function createApiRouter(store, services = {}) {
  const router = express.Router();

  router.get('/', (req, res) => res.json({
    name: 'Cashly API',
    version: 'v1',
    health: `${req.baseUrl}/health`,
    catalog: `${req.baseUrl}/catalog`,
  }));
  router.get('/health', (req, res) => res.json({ status: 'ok', service: 'cashly-api' }));
  router.use('/auth', createAuthRouter(store, services.mailer));
  router.use('/catalog', createCatalogRouter());

  router.use(createAuthMiddleware(store));
  router.use('/me', createUsersRouter(store));
  router.use('/transactions', createTransactionsRouter(store));
  router.use('/', createAnalyticsRouter(store));

  return router;
}

module.exports = { createApiRouter };
