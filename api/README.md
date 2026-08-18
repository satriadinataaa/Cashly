# Cashly Mobile API

Gunakan base URL `https://host-aplikasi/api/v1`. Endpoint lama di `/api` tetap aktif
untuk kompatibilitas web. Respons menggunakan JSON dan nama properti `camelCase`.
Saat menguji dari perangkat fisik, gunakan IP LAN komputer (contoh
`http://192.168.1.10:3000/api/v1`), bukan `localhost` milik ponsel.

## Autentikasi

Daftar atau login melalui endpoint publik, lalu kirim token pada setiap endpoint privat:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Token login berlaku tujuh hari. Simpan token pada Keychain (iOS) atau Keystore
(Android), bukan pada source code aplikasi mobile.

## Endpoint

| Method | Path | Auth | Fungsi |
|---|---|---:|---|
| GET | `/` | Tidak | Informasi versi API |
| GET | `/health` | Tidak | Health check |
| GET | `/catalog` | Tidak | Tipe, tujuan, kategori, dan constraint form |
| POST | `/auth/register` | Tidak | Membuat akun |
| POST | `/auth/login` | Tidak | Login dan memperoleh JWT |
| POST | `/auth/forgot-password` | Tidak | Meminta token reset |
| POST | `/auth/reset-password` | Tidak | Menentukan password baru |
| GET | `/me` | Ya | Profil pengguna aktif |
| PATCH | `/me/onboarding` | Ya | Menyelesaikan onboarding |
| GET | `/transactions` | Ya | Daftar dan filter transaksi |
| GET | `/transactions/:id` | Ya | Detail satu transaksi |
| POST | `/transactions` | Ya | Membuat transaksi |
| PUT | `/transactions/:id` | Ya | Mengganti seluruh transaksi |
| PATCH | `/transactions/:id` | Ya | Memperbarui sebagian transaksi |
| DELETE | `/transactions/:id` | Ya | Menghapus transaksi |
| DELETE | `/transactions/samples` | Ya | Menghapus transaksi contoh |
| GET | `/summary` | Ya | Ringkasan akuntansi kompatibel web |
| GET | `/dashboard` | Ya | Seluruh data dashboard mobile |
| GET | `/reports/cash-flow` | Ya | Laporan arus kas per aktivitas |

## Transaksi

Contoh membuat transaksi:

```json
{
  "tanggal": "2026-08-18",
  "tipe": "operasi",
  "jenis": "expense",
  "tujuan": "Kebutuhan sehari-hari",
  "arah": "keluar",
  "kategori": "Makan & Minum",
  "deskripsi": "Makan siang",
  "nominal": 35000
}
```

Field wajib: `tanggal`, `tipe`, `arah`, `kategori`, dan `nominal`. Untuk `jenis`
`transfer` atau `saving`, `akunSumber` dan `akunTujuan` juga wajib.

Filter daftar transaksi:

```text
GET /transactions?q=makan&tipe=operasi&arah=keluar&start=2026-08-01&end=2026-08-31&min=10000&max=500000&limit=25&page=1
```

Body tetap berupa array agar kompatibel dengan web. Saat `limit` atau `page` dikirim,
metadata pagination tersedia pada header `X-Total-Count`, `X-Page`, `X-Limit`, dan
`X-Has-More`. Batas maksimum adalah 100 baris per request.

## Dashboard dan laporan

Preset yang tersedia adalah `today`, `week`, `month`, dan `all`:

```text
GET /dashboard?period=month&timezone=Asia/Jakarta
GET /reports/cash-flow?start=2026-08-01&end=2026-08-31&timezone=Asia/Jakarta
```

Dashboard mengembalikan `lifetime`, `flow`, `counts`, `streak`, `recent`, `trend`,
`expenses`, dan `insights`. Insight dikirim sebagai data terstruktur agar aplikasi
mobile dapat menerjemahkan teks sendiri.

## Status error

- `400`: input atau query tidak valid
- `401`: token hilang, kedaluwarsa, atau tidak valid
- `404`: data milik pengguna tidak ditemukan
- `409`: email sudah terdaftar
- `500`: kesalahan server

Semua error JSON memiliki bentuk:

```json
{ "message": "Penjelasan kesalahan." }
```
