const { createApp } = require('./app');
const { createPool, migrate } = require('./database');
const { createStore } = require('./store');
const port = Number(process.env.PORT) || 3000;

async function start() {
  const pool = createPool();
  await migrate(pool);
  const server = createApp(createStore(pool)).listen(port, () => {
    console.log(`Cashly berjalan di http://localhost:${port}`);
  });

  async function shutdown() {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Cashly gagal dijalankan:', error.message);
  process.exit(1);
});
