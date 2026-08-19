const fs = require('node:fs');
const path = require('node:path');
const { createPool, migrate } = require('../src/database');

const source = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'cashly.json');

async function run() {
  if (!fs.existsSync(source)) {
    console.log(`Tidak ada data JSON di ${source}; tidak ada yang perlu dimigrasikan.`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(source, 'utf8'));
  const pool = createPool();
  await migrate(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const user of data.users || []) {
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, onboarding_done, email_verified_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [user.id, user.name, user.email, user.passwordHash, !!user.onboardingDone, user.createdAt, user.createdAt],
      );
    }
    for (const row of data.transactions || []) {
      await client.query(
        `INSERT INTO transactions
          (id,user_id,tanggal,tipe,tujuan,arah,kategori,deskripsi,nominal,jenis,
           akun_sumber,akun_tujuan,asset_id,liability_id,sample,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.userId, row.tanggal, row.tipe, row.tujuan || '', row.arah,
          row.kategori, row.deskripsi || '', row.nominal, row.jenis || null,
          row.akunSumber || null, row.akunTujuan || null, row.assetId || null,
          row.liabilityId || null, !!row.sample, row.createdAt, row.updatedAt || row.createdAt],
      );
    }
    await client.query('COMMIT');
    console.log(`Migrasi selesai: ${(data.users || []).length} pengguna dan ${(data.transactions || []).length} transaksi diproses.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Migrasi gagal:', error.message);
  process.exit(1);
});
