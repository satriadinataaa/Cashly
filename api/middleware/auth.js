const jwt = require('jsonwebtoken');

function createAuthMiddleware(store) {
  const secret = process.env.JWT_SECRET || 'cashly-dev-secret-change-in-production';
  return async function auth(req, res, next) {
    const raw = req.headers.authorization;
    try {
      if (!raw?.startsWith('Bearer ')) throw new Error('missing');
      req.userId = jwt.verify(raw.slice(7), secret).sub;
      const user = await store.findUserById(req.userId);
      if (!user) throw new Error('missing-user');
      if (!user.emailVerifiedAt) {
        return res.status(403).json({ message: 'Konfirmasi email diperlukan sebelum mengakses aplikasi.' });
      }
      next();
    } catch {
      res.status(401).json({ message: 'Sesi tidak valid. Silakan masuk kembali.' });
    }
  };
}

module.exports = { createAuthMiddleware };
