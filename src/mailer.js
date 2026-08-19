const nodemailer = require('nodemailer');

function smtpConfig(env = process.env) {
  const port = Number(env.SMTP_PORT || 587);
  return {
    host: String(env.SMTP_HOST || '').trim(),
    port,
    secure: String(env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    auth: {
      user: String(env.SMTP_USER || '').trim(),
      pass: String(env.SMTP_PASS || ''),
    },
    from: String(env.SMTP_FROM || env.SMTP_USER || '').trim(),
    appUrl: String(env.APP_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  };
}

function createMailer(env = process.env) {
  const config = smtpConfig(env);
  const missing = ['host', 'from'].filter(key => !config[key]);
  if (!config.auth.user) missing.push('user');
  if (!config.auth.pass) missing.push('pass');
  const transporter = missing.length ? null : nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  return {
    async sendVerification({ email, name, token }) {
      if (!transporter) throw new Error(`Konfigurasi SMTP belum lengkap: ${missing.join(', ')}.`);
      const verificationUrl = `${config.appUrl}/?verifyEmailToken=${encodeURIComponent(token)}`;
      await transporter.sendMail({
        from: config.from,
        to: email,
        subject: 'Konfirmasi email akun Cashly',
        text: `Halo ${name},\n\nKonfirmasi email akun Cashly kamu melalui tautan berikut:\n${verificationUrl}\n\nTautan ini berlaku selama 24 jam. Jika kamu tidak mendaftar, abaikan email ini.`,
        html: `<p>Halo ${escapeHtml(name)},</p><p>Konfirmasi email akun Cashly kamu dengan menekan tombol berikut:</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#287557;color:#fff;text-decoration:none;font-weight:700">Konfirmasi email</a></p><p>Tautan ini berlaku selama 24 jam. Jika kamu tidak mendaftar, abaikan email ini.</p>`,
      });
    },
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

module.exports = { createMailer, smtpConfig };
