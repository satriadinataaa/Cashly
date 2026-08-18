const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { newDb } = require('pg-mem');
const { migrate, seedDefaultAdmin } = require('../src/database');
const { createStore, mapAdminUser } = require('../src/store');

function createMemoryPool() {
  const memoryDb = newDb();
  const { Pool } = memoryDb.adapters.createPg();
  return new Pool();
}

test('migrate membuat credential admin default sebagai bcrypt hash secara idempoten', async () => {
  const pool = createMemoryPool();
  try {
    await migrate(pool, {});
    const first = await pool.query('SELECT * FROM admin_users');
    assert.equal(first.rowCount, 1);
    assert.equal(first.rows[0].username, 'admin');
    assert.equal(first.rows[0].name, 'Administrator');
    assert.notEqual(first.rows[0].password_hash, 'admin');
    assert.equal(await bcrypt.compare('admin', first.rows[0].password_hash), true);

    const originalHash = first.rows[0].password_hash;
    await seedDefaultAdmin(pool, { ADMIN_DEFAULT_USERNAME: 'ADMIN', ADMIN_DEFAULT_PASSWORD: 'diganti' });
    const second = await pool.query('SELECT * FROM admin_users');
    assert.equal(second.rowCount, 1);
    assert.equal(second.rows[0].password_hash, originalHash);
    assert.equal(await bcrypt.compare('diganti', second.rows[0].password_hash), false);
  } finally {
    await pool.end();
  }
});

test('migrate mendukung konfigurasi credential admin dari environment', async () => {
  const pool = createMemoryPool();
  try {
    await migrate(pool, {
      ADMIN_DEFAULT_USERNAME: 'Owner',
      ADMIN_DEFAULT_PASSWORD: 'rahasia-baru',
      ADMIN_DEFAULT_NAME: 'Pemilik Cashly',
    });
    const admin = await pool.query('SELECT * FROM admin_users');
    assert.equal(admin.rows[0].username, 'Owner');
    assert.equal(admin.rows[0].name, 'Pemilik Cashly');
    assert.equal(await bcrypt.compare('rahasia-baru', admin.rows[0].password_hash), true);
  } finally {
    await pool.end();
  }
});

test('username admin unik tanpa membedakan huruf besar kecil', async () => {
  const pool = createMemoryPool();
  try {
    await migrate(pool, {});
    await assert.rejects(
      pool.query(
        `INSERT INTO admin_users (id, username, name, password_hash)
         VALUES ('00000000-0000-4000-8000-000000000001', 'ADMIN', 'Duplikat', 'hash')`,
      ),
      /unique|duplicate/i,
    );
  } finally {
    await pool.end();
  }
});

test('store mencari admin secara case-insensitive dan memperbarui login terakhir', async () => {
  const pool = createMemoryPool();
  try {
    await migrate(pool, {});
    const store = createStore(pool);
    const admin = await store.findAdminByUsername('  ADMIN  ');
    assert.equal(admin.username, 'admin');
    assert.equal(admin.active, true);
    assert.equal(Object.hasOwn(admin, 'password_hash'), false);
    assert.equal(await bcrypt.compare('admin', admin.passwordHash), true);
    assert.deepEqual(await store.findAdminById('00000000-0000-4000-8000-000000000099'), null);

    const loggedInAt = new Date('2026-08-18T13:00:00.000Z');
    const updated = await store.updateAdminLastLogin(admin.id, loggedInAt);
    assert.equal(updated.lastLoginAt, loggedInAt.toISOString());
    assert.equal((await store.findAdminById(admin.id)).lastLoginAt, loggedInAt.toISOString());
  } finally {
    await pool.end();
  }
});

test('mapper admin hanya mengekspos field yang diizinkan', () => {
  const mapped = mapAdminUser({
    id: 'id', username: 'admin', name: 'Admin', password_hash: 'bcrypt-hash',
    role: 'super_admin', active: true, created_at: '2026-08-18T00:00:00Z',
    updated_at: '2026-08-18T00:00:00Z', last_login_at: null, unexpected: 'secret',
  });
  assert.deepEqual(Object.keys(mapped), [
    'id', 'username', 'name', 'passwordHash', 'role', 'active',
    'createdAt', 'updatedAt', 'lastLoginAt',
  ]);
  assert.equal(mapped.lastLoginAt, null);
});
