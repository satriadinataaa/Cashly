require('dotenv').config({ quiet: true });
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
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

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY,
  username varchar(120) NOT NULL,
  name varchar(120) NOT NULL,
  password_hash text NOT NULL,
  role varchar(40) NOT NULL DEFAULT 'super_admin',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON transactions (user_id, tanggal DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_user_type_idx ON transactions (user_id, tipe);
CREATE INDEX IF NOT EXISTS transactions_user_direction_idx ON transactions (user_id, arah);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry_idx ON password_reset_tokens (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_lower_unique
  ON admin_users (LOWER(username));
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

function defaultAdminConfig(env = process.env) {
  return {
    username: String(env.ADMIN_DEFAULT_USERNAME || 'admin').trim(),
    password: String(env.ADMIN_DEFAULT_PASSWORD || 'admin'),
    name: String(env.ADMIN_DEFAULT_NAME || 'Administrator').trim(),
  };
}

async function seedDefaultAdmin(pool, env = process.env) {
  const admin = defaultAdminConfig(env);
  if (!admin.username || !admin.password || !admin.name) {
    throw new Error('ADMIN_DEFAULT_USERNAME, ADMIN_DEFAULT_PASSWORD, dan ADMIN_DEFAULT_NAME tidak boleh kosong.');
  }

  const existing = await pool.query(
    'SELECT id FROM admin_users WHERE LOWER(username) = LOWER($1) LIMIT 1',
    [admin.username],
  );
  if (existing.rows[0]) return;

  const passwordHash = await bcrypt.hash(admin.password, 12);
  await pool.query(
    `INSERT INTO admin_users (id, username, name, password_hash, role, active)
     VALUES ($1, $2, $3, $4, 'super_admin', true)
     ON CONFLICT DO NOTHING`,
    [crypto.randomUUID(), admin.username, admin.name, passwordHash],
  );
}

async function migrate(pool, env = process.env) {
  await pool.query(SCHEMA_SQL);
  await seedDefaultAdmin(pool, env);
}

module.exports = { createPool, migrate, SCHEMA_SQL, defaultAdminConfig, seedDefaultAdmin };
