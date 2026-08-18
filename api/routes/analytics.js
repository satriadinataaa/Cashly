const express = require('express');
const { summarize } = require('../../src/accounting');
const { resolvePeriod, buildDashboard, buildCashFlowReport } = require('../services/analytics');

function parsePeriod(req, res) {
  try { return resolvePeriod(req.query); }
  catch (error) { res.status(400).json({ message: error.message }); return null; }
}

function createAnalyticsRouter(store) {
  const router = express.Router();

  router.get('/summary', async (req, res) => {
    const rows = await store.listTransactions(req.userId, { start: req.query.start, end: req.query.end });
    res.json(summarize(rows));
  });

  router.get('/dashboard', async (req, res) => {
    const period = parsePeriod(req, res);
    if (!period) return;
    const rows = await store.listTransactions(req.userId);
    res.json(buildDashboard(rows, period));
  });

  router.get('/reports/cash-flow', async (req, res) => {
    const period = parsePeriod(req, res);
    if (!period) return;
    const rows = await store.listTransactions(req.userId);
    res.json(buildCashFlowReport(rows, period));
  });

  return router;
}

module.exports = { createAnalyticsRouter };
