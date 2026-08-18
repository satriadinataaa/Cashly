require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL,
  email varchar(320) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  onboarding_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal date NOT NULL,
  tipe varchar(20) NOT NULL CHECK (tipe IN ('operasi', 'investasi', 'pendanaan')),
  tujuan varchar(80) NOT NULL DEFAULT '',
  arah varchar(10) NOT NULL CHECK (arah IN ('masuk', 'keluar')),
  kategori varchar(120) NOT NULL,
  deskripsi varchar(200) NOT NULL DEFAULT '',
  nominal bigint NOT NULL CHECK (nominal > 0),
  jenis varchar(30),
  akun_sumber varchar(80),
  akun_tujuan varchar(80),
  asset_id varchar(80),
  liability_id varchar(80),
  sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON transactions (user_id, tanggal DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_user_type_idx ON transactions (user_id, tipe);
CREATE INDEX IF NOT EXISTS transactions_user_direction_idx ON transactions (user_id, arah);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry_idx ON password_reset_tokens (expires_at);
`;

function createPool(config = {}) {
  const connectionString = config.connectionString || process.env.DATABASE_URL;
  if (!connectionString && !config.host) {
    throw new Error('DATABASE_URL wajib diisi untuk menghubungkan Cashly ke PostgreSQL.');
  }
  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    ...config,
  });
}

async function migrate(pool) {
  await pool.query(SCHEMA_SQL);
}

module.exports = { createPool, migrate, SCHEMA_SQL };
