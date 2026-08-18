# Cashly Admin UI

Frontend admin yang disajikan oleh aplikasi utama pada route `/admin`.

- Halaman: `/admin`
- Autentikasi: `/api/admin/auth/login`
- Sesi: `/api/admin/session`
- Insight: `/api/admin/insights`
- Credential: tabel PostgreSQL `admin_users`
- Sesi login: tabel PostgreSQL `admin_sessions`

Folder ini bukan aplikasi Node.js terpisah. Jalankan server dari root repository dengan `npm run dev`.
