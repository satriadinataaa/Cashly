function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    onboardingDone: row.onboarding_done,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapTransaction(row) {
  if (!row) return null;
  const tanggal = row.tanggal instanceof Date
    ? row.tanggal.toISOString().slice(0, 10)
    : String(row.tanggal).slice(0, 10);
  const result = {
    id: row.id,
    userId: row.user_id,
    tanggal,
    tipe: row.tipe,
    tujuan: row.tujuan,
    arah: row.arah,
    kategori: row.kategori,
    deskripsi: row.deskripsi,
    nominal: Number(row.nominal),
    sample: row.sample,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
  for (const [column, key] of [
    ['jenis', 'jenis'], ['akun_sumber', 'akunSumber'], ['akun_tujuan', 'akunTujuan'],
    ['asset_id', 'assetId'], ['liability_id', 'liabilityId'],
  ]) {
    if (row[column]) result[key] = row[column];
  }
  return result;
}

function createStore(pool) {
  return {
    async findUserByEmail(email) {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      return mapUser(result.rows[0]);
    },

    async findUserById(id) {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return mapUser(result.rows[0]);
    },

    async createUser(user) {
      const result = await pool.query(
        `INSERT INTO users (id, name, email, password_hash, onboarding_done, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [user.id, user.name, user.email, user.passwordHash, user.onboardingDone, user.createdAt],
      );
      return mapUser(result.rows[0]);
    },

    async completeOnboarding(userId) {
      const result = await pool.query(
        'UPDATE users SET onboarding_done = true WHERE id = $1 RETURNING *', [userId],
      );
      return mapUser(result.rows[0]);
    },

    async createPasswordResetToken(token) {
      await pool.query(
        `UPDATE password_reset_tokens SET used_at = now()
         WHERE user_id = $1 AND used_at IS NULL`,
        [token.userId],
      );
      await pool.query(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [token.id, token.userId, token.tokenHash, token.expiresAt, token.createdAt],
      );
    },

    async resetPassword(tokenHash, passwordHash) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tokenResult = await client.query(
          `SELECT id, user_id FROM password_reset_tokens
           WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
           FOR UPDATE`,
          [tokenHash],
        );
        const token = tokenResult.rows[0];
        if (!token) {
          await client.query('ROLLBACK');
          return false;
        }
        await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, token.user_id]);
        await client.query(
          'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
          [token.user_id],
        );
        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async listTransactions(userId, filters = {}) {
      const values = [userId];
      const where = ['user_id = $1'];
      const add = (sql, value) => { values.push(value); where.push(sql.replace('?', `$${values.length}`)); };
      if (filters.q) add("LOWER(kategori || ' ' || deskripsi) LIKE ?", `%${String(filters.q).toLowerCase()}%`);
      if (filters.tipe) add('tipe = ?', filters.tipe);
      if (filters.arah) add('arah = ?', filters.arah);
      if (filters.start) add('tanggal >= ?', filters.start);
      if (filters.end) add('tanggal <= ?', filters.end);
      if (filters.min != null) add('nominal >= ?', filters.min);
      if (filters.max != null) add('nominal <= ?', filters.max);
      const result = await pool.query(
        `SELECT * FROM transactions WHERE ${where.join(' AND ')} ORDER BY tanggal DESC, created_at DESC`, values,
      );
      return result.rows.map(mapTransaction);
    },

    async createTransaction(row) {
      const result = await pool.query(
        `INSERT INTO transactions
          (id, user_id, tanggal, tipe, tujuan, arah, kategori, deskripsi, nominal, jenis,
           akun_sumber, akun_tujuan, asset_id, liability_id, sample, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [row.id, row.userId, row.tanggal, row.tipe, row.tujuan, row.arah, row.kategori,
          row.deskripsi, row.nominal, row.jenis || null, row.akunSumber || null,
          row.akunTujuan || null, row.assetId || null, row.liabilityId || null,
          row.sample, row.createdAt, row.updatedAt],
      );
      return mapTransaction(result.rows[0]);
    },

    async updateTransaction(id, userId, row) {
      const result = await pool.query(
        `UPDATE transactions SET tanggal=$3, tipe=$4, tujuan=$5, arah=$6, kategori=$7,
          deskripsi=$8, nominal=$9, jenis=$10, akun_sumber=$11, akun_tujuan=$12,
          asset_id=$13, liability_id=$14, sample=false, updated_at=$15
         WHERE id=$1 AND user_id=$2 RETURNING *`,
        [id, userId, row.tanggal, row.tipe, row.tujuan, row.arah, row.kategori,
          row.deskripsi, row.nominal, row.jenis || null, row.akunSumber || null,
          row.akunTujuan || null, row.assetId || null, row.liabilityId || null, row.updatedAt],
      );
      return mapTransaction(result.rows[0]);
    },

    async deleteTransaction(id, userId) {
      const result = await pool.query('DELETE FROM transactions WHERE id=$1 AND user_id=$2', [id, userId]);
      return result.rowCount > 0;
    },

    async deleteSampleTransactions(userId) {
      const result = await pool.query('DELETE FROM transactions WHERE user_id=$1 AND sample=true', [userId]);
      return result.rowCount;
    },
  };
}

module.exports = { createStore, mapUser, mapTransaction };
