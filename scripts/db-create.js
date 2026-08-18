require('dotenv').config({ quiet: true });
const { Client } = require('pg');

async function run() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib diisi.');
  const target = new URL(process.env.DATABASE_URL);
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(databaseName)) throw new Error('Nama database tidak valid.');
  target.pathname = '/postgres';
  const client = new Client({ connectionString: target.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (existing.rowCount) {
      console.log(`Database ${databaseName} sudah tersedia.`);
      return;
    }
    await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
    console.log(`Database ${databaseName} berhasil dibuat.`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('Pembuatan database gagal:', error.message);
  process.exit(1);
});
