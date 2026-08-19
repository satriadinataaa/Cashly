const express = require('express');
const crypto = require('node:crypto');
const { KINDS } = require('../../src/accounting');
const { TYPES, DIRECTIONS } = require('../constants');
const { isIsoDate } = require('../validation');

function validTransaction(body) {
  const nominal = Number(body.nominal);
  if (!isIsoDate(body.tanggal)) return 'Tanggal tidak valid.';
  if (!TYPES.includes(body.tipe)) return 'Tipe arus kas tidak valid.';
  if (!DIRECTIONS.includes(body.arah)) return 'Arah transaksi tidak valid.';
  if (body.jenis != null && !KINDS.includes(body.jenis)) return 'Jenis transaksi tidak valid.';
  if (['transfer', 'saving'].includes(body.jenis)
      && (!String(body.akunSumber || '').trim() || !String(body.akunTujuan || '').trim())) {
    return 'Rekening sumber dan tujuan wajib diisi untuk perpindahan internal.';
  }
  if (!String(body.kategori || '').trim()) return 'Kategori wajib dipilih.';
  if (!Number.isSafeInteger(nominal) || nominal <= 0 || nominal > 999999999999) {
    return 'Nominal harus berupa bilangan bulat positif.';
  }
  return null;
}

function accountingFields(body) {
  const fields = {};
  for (const key of ['jenis', 'akunSumber', 'akunTujuan', 'assetId', 'liabilityId']) {
    const value = String(body[key] || '').trim();
    if (value) fields[key] = value.slice(0, 80);
  }
  return fields;
}

function transactionPayload(body) {
  return {
    tanggal: body.tanggal,
    tipe: body.tipe,
    tujuan: String(body.tujuan || '').trim().slice(0, 80),
    arah: body.arah,
    kategori: String(body.kategori).trim().slice(0, 120),
    deskripsi: String(body.deskripsi || '').trim().slice(0, 200),
    nominal: Number(body.nominal),
    ...accountingFields(body),
  };
}

function queryFilters(query) {
  if (query.tipe && !TYPES.includes(query.tipe)) throw new Error('Tipe arus kas tidak valid.');
  if (query.arah && !DIRECTIONS.includes(query.arah)) throw new Error('Arah transaksi tidak valid.');
  for (const key of ['start', 'end']) {
    if (query[key] && !isIsoDate(query[key])) throw new Error(`${key} harus berupa tanggal YYYY-MM-DD yang valid.`);
  }
  const filters = {
    q: query.q,
    tipe: query.tipe,
    arah: query.arah,
    start: query.start,
    end: query.end,
    min: query.min !== undefined && Number.isFinite(Number(query.min)) ? Number(query.min) : undefined,
    max: query.max !== undefined && Number.isFinite(Number(query.max)) ? Number(query.max) : undefined,
  };
  if (query.limit !== undefined || query.page !== undefined) {
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || '25', 10) || 25));
    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    filters.limit = limit;
    filters.offset = (page - 1) * limit;
    filters.page = page;
  }
  return filters;
}

function createTransactionsRouter(store) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    let filters;
    try { filters = queryFilters(req.query); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    const rows = await store.listTransactions(req.userId, filters);
    if (filters.limit) {
      const total = await store.countTransactions(req.userId, filters);
      res.set({
        'X-Total-Count': String(total),
        'X-Page': String(filters.page),
        'X-Limit': String(filters.limit),
        'X-Has-More': String(filters.offset + rows.length < total),
      });
    }
    res.json(rows);
  });

  router.get('/:id', async (req, res) => {
    const row = await store.findTransactionById(req.params.id, req.userId);
    if (!row) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    res.json(row);
  });

  router.post('/', async (req, res) => {
    const error = validTransaction(req.body);
    if (error) return res.status(400).json({ message: error });
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(), userId: req.userId, ...transactionPayload(req.body),
      sample: false, createdAt: now, updatedAt: now,
    };
    res.status(201).json(await store.createTransaction(row));
  });

  router.post('/bulk', async (req, res) => {
    const user = await store.findUserById(req.userId);
    if (!user?.emailVerifiedAt) return res.status(403).json({ message: 'Konfirmasi email diperlukan untuk menggunakan input transaksi bulk.' });
    if (!Array.isArray(req.body.transactions) || req.body.transactions.length < 2 || req.body.transactions.length > 50) return res.status(400).json({ message: 'Jumlah transaksi harus antara 2 dan 50.' });
    for (let index = 0; index < req.body.transactions.length; index += 1) {
      const error = validTransaction(req.body.transactions[index]);
      if (error) return res.status(400).json({ message: `Transaksi ${index + 1}: ${error}` });
    }
    const now = new Date().toISOString();
    const rows = req.body.transactions.map(body => ({ id: crypto.randomUUID(), userId: req.userId, ...transactionPayload(body), sample: false, createdAt: now, updatedAt: now }));
    res.status(201).json(await store.createTransactions(rows));
  });

  async function update(req, res, partial) {
    let body = req.body;
    if (partial) {
      const current = await store.findTransactionById(req.params.id, req.userId);
      if (!current) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
      body = { ...current, ...req.body };
    }
    const error = validTransaction(body);
    if (error) return res.status(400).json({ message: error });
    const row = await store.updateTransaction(req.params.id, req.userId, {
      ...transactionPayload(body), updatedAt: new Date().toISOString(),
    });
    if (!row) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    res.json(row);
  }

  router.put('/:id', (req, res) => update(req, res, false));
  router.patch('/:id', (req, res) => update(req, res, true));

  router.delete('/samples', async (req, res) => {
    res.json({ deleted: await store.deleteSampleTransactions(req.userId) });
  });

  // Alias lama untuk web client. Mobile sebaiknya memakai DELETE /transactions/samples.
  router.delete('/', async (req, res) => {
    res.json({ deleted: await store.deleteSampleTransactions(req.userId) });
  });

  router.delete('/:id', async (req, res) => {
    if (!(await store.deleteTransaction(req.params.id, req.userId))) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    }
    res.status(204).end();
  });

  return router;
}

module.exports = { createTransactionsRouter, validTransaction, transactionPayload, queryFilters };
