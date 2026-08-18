const jwt = require('jsonwebtoken');

function createAuthMiddleware() {
  const secret = process.env.JWT_SECRET || 'cashly-dev-secret-change-in-production';
  return function auth(req, res, next) {
    const raw = req.headers.authorization;
    try {
      if (!raw?.startsWith('Bearer ')) throw new Error('missing');
      req.userId = jwt.verify(raw.slice(7), secret).sub;
      next();
    } catch {
      res.status(401).json({ message: 'Sesi tidak valid. Silakan masuk kembali.' });
    }
  };
}

module.exports = { createAuthMiddleware };
