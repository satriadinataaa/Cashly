# Cashly

Aplikasi web Node.js untuk mencatat arus kas pribadi berdasarkan tiga klasifikasi akuntansi: operasi, investasi, dan pendanaan.

## Clone otomatis di Windows

Simpan `clone-cashly.ps1`, lalu jalankan dari folder tempat proyek ingin dibuat:

```powershell
powershell -ExecutionPolicy Bypass -File .\clone-cashly.ps1
```

Untuk memilih nama folder tujuan:

```powershell
powershell -ExecutionPolicy Bypass -File .\clone-cashly.ps1 -TargetDirectory WebsiteMoneyTracker
```

## Menjalankan aplikasi

Siapkan database dan pengguna PostgreSQL, salin `.env.example` menjadi `.env`, lalu isi
kredensialnya. `DATABASE_URL` wajib tersedia saat aplikasi dijalankan.

```bash
npm install
npm run db:migrate
npm start
```

Buka `http://localhost:3000`. Setiap akun baru harus mengonfirmasi alamat email sebelum
dapat masuk, dimulai dengan arus kas kosong, dan seluruh transaksi hanya dapat diakses
oleh pemilik akun tersebut.

## Dashboard admin

Dashboard admin menjadi bagian dari aplikasi yang sama dan tersedia di
`http://localhost:3000/admin`. Autentikasi admin memakai cookie sesi khusus dan secret
yang berbeda dari JWT pengguna.

Akun awal dibuat otomatis pada tabel `admin_users` saat migrasi database. Credential
bawaannya adalah username `admin` dengan password `admin`; password disimpan sebagai
hash bcrypt, bukan plaintext. Segera ganti password default dengan:

```bash
npm run admin:set-password -- admin "password-admin-baru"
```

Nilai akun awal dapat diatur melalui `ADMIN_DEFAULT_USERNAME`,
`ADMIN_DEFAULT_PASSWORD`, dan `ADMIN_DEFAULT_NAME` sebelum migrasi pertama.
Sesi admin disimpan sebagai hash token pada tabel `admin_sessions`, sehingga tidak
memerlukan `ADMIN_SESSION_SECRET` di environment.

## API aplikasi mobile

Backend modular berada di folder `api/` dan tersedia melalui base URL `/api/v1`.
Kontrak endpoint, autentikasi, pagination, dashboard, dan laporan tersedia di
[`api/README.md`](api/README.md). Endpoint `/api` lama tetap tersedia agar web client
tidak mengalami breaking change.

Untuk development dengan auto-reload:

```bash
npm run dev
```

Untuk menjalankan pengujian API:

```bash
npm test
```

## Konfigurasi

Salin `.env.example`, lalu set `PORT`, `JWT_SECRET`, `APP_URL`, dan credential SMTP
(`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
`APP_URL` digunakan sebagai alamat tujuan pada tautan konfirmasi email. Pada production,
`JWT_SECRET` wajib diganti dengan nilai acak yang kuat dan aplikasi wajib ditempatkan di
belakang HTTPS.

Seluruh akun dan transaksi disimpan di PostgreSQL. Tabel dan indeks juga dibuat otomatis
saat startup. Untuk mengimpor data dari penyimpanan JSON versi lama satu kali, jalankan:

```bash
npm run db:import-json
```

Impor aman dijalankan ulang karena ID yang sudah ada tidak akan diduplikasi. Setelah data
terverifikasi di PostgreSQL, file JSON lama dapat diarsipkan.
