require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { createPool } = require('../src/database');

async function main() {
  const username = String(process.argv[2] || '').trim().toLowerCase();
  const password = String(process.argv[3] || '');
  if (!username || !password) {
    throw new Error('Gunakan: npm run admin:set-password -- <username> <password-baru>');
  }
  const pool = createPool();
  try {
    const result = await pool.query(
      `UPDATE admin_users
       SET password_hash = $1, updated_at = now()
       WHERE LOWER(username) = $2
       RETURNING username`,
      [await bcrypt.hash(password, 12), username],
    );
    if (!result.rowCount) throw new Error(`Admin "${username}" tidak ditemukan.`);
    console.log(`Password admin "${result.rows[0].username}" berhasil diperbarui.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
