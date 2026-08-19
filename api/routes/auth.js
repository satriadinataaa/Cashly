const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, onboardingDone: !!user.onboardingDone, emailVerified: !!user.emailVerifiedAt };
}

function createAuthRouter(store, mailer) {
  const router = express.Router();
  const secret = process.env.JWT_SECRET || 'cashly-dev-secret-change-in-production';
  const tokenFor = (user) => jwt.sign({ sub: user.id }, secret, { expiresIn: '7d' });
  const sendVerification = async user => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await store.createEmailVerificationToken({
      id: crypto.randomUUID(), userId: user.id,
      tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    await mailer.sendVerification({ email: user.email, name: user.name, token: rawToken });
    return rawToken;
  };

  router.post('/register', async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2) return res.status(400).json({ message: 'Nama minimal 2 karakter.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Email tidak valid.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password minimal 8 karakter.' });
    if (await store.findUserByEmail(email)) return res.status(409).json({ message: 'Email sudah terdaftar.' });
    const user = {
      id: crypto.randomUUID(), name, email, passwordHash: await bcrypt.hash(password, 12),
      onboardingDone: false, emailVerifiedAt: null, createdAt: new Date().toISOString(),
    };
    try {
      const created = await store.createUser(user);
      const verificationToken = await sendVerification(created);
      const response = {
        message: 'Pendaftaran berhasil. Periksa Inbox, Spam, atau Junk lalu konfirmasi email untuk membuka fitur transaksi bulk.',
        token: tokenFor(created),
        user: publicUser(created),
      };
      if (process.env.NODE_ENV !== 'production') response.verificationToken = verificationToken;
      res.status(201).json(response);
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Email sudah terdaftar.' });
      throw error;
    }
  });

  router.post('/verify-email', async (req, res) => {
    const token = String(req.body.token || '');
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ message: 'Tautan konfirmasi tidak valid atau sudah kedaluwarsa.' });
    const user = await store.verifyEmail(crypto.createHash('sha256').update(token).digest('hex'));
    if (!user) return res.status(400).json({ message: 'Tautan konfirmasi tidak valid atau sudah kedaluwarsa.' });
    res.json({ message: 'Email berhasil dikonfirmasi. Silakan masuk ke Cashly.' });
  });

  router.post('/resend-verification', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await store.findUserByEmail(email);
    const response = { message: 'Jika akun belum aktif, email konfirmasi baru telah dikirim. Periksa juga folder Spam atau Junk.' };
    if (!user || user.emailVerifiedAt) return res.json(response);
    const verificationToken = await sendVerification(user);
    if (process.env.NODE_ENV !== 'production') response.verificationToken = verificationToken;
    res.json(response);
  });

  router.post('/login', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await store.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }
    res.json({ token: tokenFor(user), user: publicUser(user) });
  });

  router.post('/forgot-password', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await store.findUserByEmail(email);
    const response = { message: 'Jika email terdaftar, tautan reset password telah dibuat.' };
    if (!user) return res.json(response);
    const rawToken = crypto.randomBytes(32).toString('hex');
    await store.createPasswordResetToken({
      id: crypto.randomUUID(), userId: user.id,
      tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    if (process.env.NODE_ENV !== 'production') response.resetToken = rawToken;
    res.json(response);
  });

  router.post('/reset-password', async (req, res) => {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ message: 'Token reset tidak valid atau sudah kedaluwarsa.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password minimal 8 karakter.' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const changed = await store.resetPassword(tokenHash, await bcrypt.hash(password, 12));
    if (!changed) return res.status(400).json({ message: 'Token reset tidak valid atau sudah kedaluwarsa.' });
    res.json({ message: 'Password berhasil diperbarui. Silakan masuk.' });
  });

  return router;
}

module.exports = { createAuthRouter, publicUser };
