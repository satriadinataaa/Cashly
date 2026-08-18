const { createPool, migrate } = require('../src/database');

async function run() {
  const pool = createPool();
  try {
    await migrate(pool);
    console.log('Skema PostgreSQL Cashly siap.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Migrasi skema gagal:', error.message);
  process.exit(1);
});
