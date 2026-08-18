const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const { KINDS, summarize } = require('./accounting');

const JWT_SECRET = process.env.JWT_SECRET || 'cashly-dev-secret-change-in-production';
const TYPES = ['operasi', 'investasi', 'pendanaan'];
const DIRECTIONS = ['masuk', 'keluar'];

function publicUser(user) { return { id: user.id, name: user.name, email: user.email, onboardingDone: !!user.onboardingDone }; }
function tokenFor(user) { return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' }); }
function auth(req, res, next) {
  const raw = req.headers.authorization;
  try {
    if (!raw?.startsWith('Bearer ')) throw new Error('missing');
    req.userId = jwt.verify(raw.slice(7), JWT_SECRET).sub;
    next();
  } catch { res.status(401).json({ message: 'Sesi tidak valid. Silakan masuk kembali.' }); }
}
function validTransaction(body) {
  const nominal = Number(body.nominal);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.tanggal || '')) return 'Tanggal tidak valid.';
  if (!TYPES.includes(body.tipe)) return 'Tipe arus kas tidak valid.';
  if (!DIRECTIONS.includes(body.arah)) return 'Arah transaksi tidak valid.';
  if (body.jenis != null && !KINDS.includes(body.jenis)) return 'Jenis transaksi tidak valid.';
  if (['transfer', 'saving'].includes(body.jenis) && (!String(body.akunSumber || '').trim() || !String(body.akunTujuan || '').trim())) return 'Rekening sumber dan tujuan wajib diisi untuk perpindahan internal.';
  if (!String(body.kategori || '').trim()) return 'Kategori wajib dipilih.';
  if (!Number.isSafeInteger(nominal) || nominal <= 0 || nominal > 999999999999) return 'Nominal harus berupa bilangan bulat positif.';
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

function createApp(store) {
  if (!store) throw new Error('Store PostgreSQL wajib diberikan ke createApp().');
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb' }));

  app.post('/api/auth/register', async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2) return res.status(400).json({ message: 'Nama minimal 2 karakter.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Email tidak valid.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password minimal 8 karakter.' });
    if (await store.findUserByEmail(email)) return res.status(409).json({ message: 'Email sudah terdaftar.' });
    const user = { id: crypto.randomUUID(), name, email, passwordHash: await bcrypt.hash(password, 12), onboardingDone: false, createdAt: new Date().toISOString() };
    try {
      const created = await store.createUser(user);
      res.status(201).json({ token: tokenFor(created), user: publicUser(created) });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Email sudah terdaftar.' });
      throw error;
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await store.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ message: 'Email atau password salah.' });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await store.findUserByEmail(email);
    const response = { message: 'Jika email terdaftar, tautan reset password telah dibuat.' };
    if (!user) return res.json(response);

    const rawToken = crypto.randomBytes(32).toString('hex');
    await store.createPasswordResetToken({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    if (process.env.NODE_ENV !== 'production') response.resetToken = rawToken;
    res.json(response);
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ message: 'Token reset tidak valid atau sudah kedaluwarsa.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password minimal 8 karakter.' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const changed = await store.resetPassword(tokenHash, await bcrypt.hash(password, 12));
    if (!changed) return res.status(400).json({ message: 'Token reset tidak valid atau sudah kedaluwarsa.' });
    res.json({ message: 'Password berhasil diperbarui. Silakan masuk.' });
  });

  app.get('/api/me', auth, async (req, res) => {
    const user = await store.findUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    res.json(publicUser(user));
  });
  app.patch('/api/me/onboarding', auth, async (req, res) => {
    const user = await store.completeOnboarding(req.userId);
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    res.json(publicUser(user));
  });

  app.get('/api/transactions', auth, async (req, res) => {
    const { q, tipe, arah, start, end, min, max } = req.query;
    const rows = await store.listTransactions(req.userId, {
      q,
      tipe: TYPES.includes(tipe) ? tipe : undefined,
      arah: DIRECTIONS.includes(arah) ? arah : undefined,
      start,
      end,
      min: min && Number.isFinite(Number(min)) ? Number(min) : undefined,
      max: max && Number.isFinite(Number(max)) ? Number(max) : undefined,
    });
    res.json(rows);
  });
  app.get('/api/summary', auth, async (req, res) => {
    const rows = await store.listTransactions(req.userId, { start: req.query.start, end: req.query.end });
    res.json(summarize(rows));
  });
  app.post('/api/transactions', auth, async (req, res) => {
    const error = validTransaction(req.body); if (error) return res.status(400).json({ message: error });
    const now = new Date().toISOString();
    const row = { id: crypto.randomUUID(), userId: req.userId, tanggal: req.body.tanggal, tipe: req.body.tipe, tujuan: String(req.body.tujuan || '').trim().slice(0, 80), arah: req.body.arah, kategori: String(req.body.kategori).trim(), deskripsi: String(req.body.deskripsi || '').trim().slice(0, 200), nominal: Number(req.body.nominal), ...accountingFields(req.body), sample: false, createdAt: now, updatedAt: now };
    res.status(201).json(await store.createTransaction(row));
  });
  app.put('/api/transactions/:id', auth, async (req, res) => {
    const error = validTransaction(req.body); if (error) return res.status(400).json({ message: error });
    const row = await store.updateTransaction(req.params.id, req.userId, {
      tanggal:req.body.tanggal, tipe:req.body.tipe, tujuan:String(req.body.tujuan||'').trim().slice(0,80),
      arah:req.body.arah, kategori:String(req.body.kategori).trim(), deskripsi:String(req.body.deskripsi||'').trim().slice(0,200),
      nominal:Number(req.body.nominal), ...accountingFields(req.body), updatedAt:new Date().toISOString(),
    });
    if (!row) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    res.json(row);
  });
  app.delete('/api/transactions/:id', auth, async (req, res) => {
    if (!(await store.deleteTransaction(req.params.id, req.userId))) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    res.status(204).end();
  });
  app.delete('/api/transactions', auth, async (req, res) => {
    res.json({ deleted: await store.deleteSampleTransactions(req.userId) });
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/{*splat}', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
  app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: 'Terjadi kesalahan pada server.' }); });
  return app;
}
module.exports = { createApp };
