const express = require('express');
const { publicUser } = require('./auth');

function createUsersRouter(store) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const user = await store.findUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    res.json(publicUser(user));
  });

  router.patch('/onboarding', async (req, res) => {
    const user = await store.completeOnboarding(req.userId);
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    res.json(publicUser(user));
  });

  return router;
}

module.exports = { createUsersRouter };
