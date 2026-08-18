# Product Requirements Document (PRD)
## Aplikasi Web Pencatat Arus Kas Pribadi ("Cashly")

| | |
|---|---|
| **Versi Dokumen** | 1.0 |
| **Tanggal** | 11 Agustus 2026 |
| **Status** | Draft |
| **Pemilik Produk** | Product Owner |

---

## 1. Ringkasan Produk

Cashly adalah aplikasi web untuk mencatat pemasukan dan pengeluaran uang secara personal, menggunakan struktur klasifikasi **arus kas ala akuntansi** (Aktivitas Operasi, Aktivitas Investasi, Aktivitas Pendanaan). Aplikasi ini menyediakan visualisasi data (chart) secara real-time agar pengguna dapat memantau kondisi keuangannya kapan saja, dengan tampilan yang menarik dan alur input yang sederhana sehingga tidak membuat pengguna malas mencatat.

**Value proposition utama:**
- Mencatat transaksi keuangan dengan kategori yang benar secara akuntansi, tapi disederhanakan agar tetap mudah dipahami orang awam.
- Visualisasi otomatis (chart) yang update secara real-time setiap kali transaksi baru dimasukkan.
- UI yang estetik dan menyenangkan agar mencatat keuangan terasa seperti kebiasaan yang ringan, bukan beban.

---

## 2. Latar Belakang & Masalah

| Masalah | Dampak |
|---|---|
| Banyak orang tidak konsisten mencatat pengeluaran karena aplikasi pencatatan terasa membosankan/rumit | Sulit tahu ke mana uang "menguap" tiap bulan |
| Aplikasi keuangan pribadi umumnya hanya membedakan "masuk" vs "keluar" tanpa konteks sumber dana | Pengguna tidak paham apakah uangnya berasal dari kerja, investasi, atau utang |
| Laporan keuangan sering hanya berupa tabel angka | Sulit membaca tren dan pola pengeluaran secara cepat |
| Proses input yang panjang/berbelit | Pengguna berhenti menggunakan aplikasi setelah beberapa hari |

---

## 3. Tujuan Produk

1. Memudahkan pengguna mencatat transaksi keuangan dalam < 15 detik per entri.
2. Mengedukasi pengguna awam tentang konsep arus kas (cash flow) ala akuntansi secara implisit lewat penggunaan sehari-hari.
3. Menyediakan visibilitas real-time atas kondisi kas melalui chart interaktif.
4. Meningkatkan tingkat retensi pencatatan harian melalui UI yang menarik dan low-friction.

### Success Metrics (KPI)
- **Daily Active Logging Rate**: ≥ 60% pengguna mencatat minimal 1 transaksi/hari dalam 30 hari pertama.
- **Time to first transaction**: < 60 detik sejak akun dibuat.
- **Retention D7**: ≥ 40%.
- **Average input time per transaksi**: < 15 detik.
- **NPS terkait tampilan (UI/UX)**: ≥ 8/10.

---

## 4. Target Pengguna

### Persona 1: "Rani, si Pemula Keuangan" (25 tahun, karyawan)
- Belum pernah mencatat keuangan secara rutin.
- Butuh sesuatu yang simpel, visual, tidak butuh pengetahuan akuntansi.

### Persona 2: "Dimas, Freelancer/Pemilik Usaha Kecil" (30 tahun)
- Punya banyak sumber pemasukan (klien, investasi kecil, pinjaman modal).
- Butuh pemisahan arus kas yang lebih jelas agar tahu uang usaha vs uang pribadi.

### Persona 3: "Bu Sari, ingin mulai mengatur keuangan keluarga" (40 tahun)
- Tidak terbiasa dengan istilah teknis, butuh onboarding yang membimbing.

---

## 5. Ruang Lingkup

### In Scope (MVP)
- Autentikasi (register/login) — email & password, opsional login via Google.
- Input transaksi pemasukan & pengeluaran dengan kategori arus kas.
- Dashboard dengan chart real-time.
- Laporan ringkas per periode (harian/mingguan/bulanan).
- Riwayat transaksi dengan filter & pencarian.
- Onboarding interaktif untuk pengguna baru.
- Mode edit/hapus transaksi.
- Saldo kas berjalan (running balance).

### Out of Scope (Fase Berikutnya / Nice to Have)
- Integrasi rekening bank / e-wallet otomatis.
- Multi-akun/kolaborasi keluarga.
- Export laporan ke PDF/Excel.
- Reminder/notifikasi otomatis.
- Fitur budgeting & target tabungan.
- Aplikasi mobile native.

---

## 6. Struktur Data: Tipe Arus Kas (Berdasarkan Ilmu Akuntansi)

Mengikuti konsep **Laporan Arus Kas (Statement of Cash Flow)**, transaksi dikelompokkan ke dalam 3 aktivitas utama. Setiap aktivitas punya sub-kategori pemasukan (Cash In) dan pengeluaran (Cash Out) yang sudah disederhanakan bahasanya untuk pengguna awam.

### 6.1 Aktivitas Operasi (Operating Activities)
Arus kas dari kegiatan sehari-hari / bisnis utama.

| Arah | Sub-kategori Contoh |
|---|---|
| Cash In | Gaji, Pendapatan Usaha/Freelance, Bonus, Penjualan Produk/Jasa |
| Cash Out | Belanja Harian, Makan & Minum, Transportasi, Tagihan (listrik/air/internet), Sewa, Gaji Karyawan (jika usaha) |

### 6.2 Aktivitas Investasi (Investing Activities)
Arus kas dari pembelian/penjualan aset jangka panjang atau instrumen investasi.

| Arah | Sub-kategori Contoh |
|---|---|
| Cash In | Penjualan Saham/Reksadana, Pencairan Deposito, Penjualan Aset (kendaraan, properti) |
| Cash Out | Pembelian Saham/Reksadana/Emas, Pembelian Aset (laptop, kendaraan), Penyertaan Modal Usaha |

### 6.3 Aktivitas Pendanaan (Financing Activities)
Arus kas terkait utang, modal, dan kewajiban pembiayaan.

| Arah | Sub-kategori Contoh |
|---|---|
| Cash In | Pinjaman Masuk (utang baru), Modal dari Investor/Keluarga |
| Cash Out | Cicilan/Pembayaran Utang, Bagi Hasil/Dividen, Pengembalian Modal |

> Sistem menampilkan istilah ini dengan bahasa sederhana di UI (misalnya "Uang Kerja & Belanja Sehari-hari", "Investasi & Aset", "Utang & Modal") namun tetap menyimpan klasifikasi akuntansi di backend agar laporan tetap valid secara struktur.

---

## 7. Fitur Utama

### 7.1 Input Transaksi Cepat
- Form input dengan field: **Tanggal**, **Tipe Arus Kas** (Operasi/Investasi/Pendanaan), **Arah** (Masuk/Keluar), **Kategori**, **Nominal**, **Catatan (opsional)**.
- Quick-add floating button (+) selalu terlihat di semua halaman.
- Preset kategori favorit berdasarkan histori pengguna agar makin cepat diisi seiring waktu.
- Validasi nominal otomatis format Rupiah (Rp) saat mengetik.
- Opsi input suara/foto struk untuk fase berikutnya (disebutkan sebagai future enhancement).

**Acceptance Criteria:**
- Pengguna dapat menyelesaikan 1 entri transaksi dalam maksimal 3 langkah/klik.
- Setelah submit, chart & saldo di dashboard otomatis ter-update tanpa reload halaman.

### 7.2 Dashboard Real-Time dengan Chart
- **Ringkasan Saldo**: Total kas saat ini, total pemasukan, total pengeluaran (periode terpilih).
- **Donut/Pie Chart**: Komposisi pengeluaran per tipe arus kas & per kategori.
- **Line/Area Chart**: Tren saldo kas dari waktu ke waktu.
- **Bar Chart**: Perbandingan pemasukan vs pengeluaran per bulan/minggu.
- Filter periode: Hari ini, Minggu ini, Bulan ini, Custom range.
- Update chart secara live (tanpa refresh) begitu ada transaksi baru — menggunakan state management reaktif di frontend.

### 7.3 Riwayat & Manajemen Transaksi
- List transaksi dengan pengelompokan per tanggal.
- Filter berdasarkan tipe arus kas, kategori, rentang nominal, rentang tanggal.
- Search bar.
- Edit & hapus transaksi (dengan konfirmasi).

### 7.4 Laporan Arus Kas Sederhana
- Ringkasan otomatis ala "Statement of Cash Flow" per periode: total arus kas Operasi, Investasi, dan Pendanaan — disajikan dengan visual & bahasa yang mudah dipahami.

### 7.5 Onboarding Pemula-Friendly
- Tur singkat interaktif (3–4 langkah) saat pertama kali login menjelaskan konsep 3 tipe arus kas dengan ilustrasi & analogi sederhana.
- Tooltip kontekstual di form input untuk menjelaskan istilah (misalnya, ikon "?" di sebelah "Aktivitas Pendanaan").
- Data contoh (sample data) otomatis tersedia agar pengguna baru bisa melihat dashboard "terisi" sebelum mulai input sendiri (bisa dihapus kapan saja).

### 7.6 Desain & Estetika UI
- Desain modern, clean, dengan palet warna yang menenangkan namun tetap hidup (hindari kesan aplikasi akuntansi kaku/kantoran).
- Micro-interaction: animasi halus saat transaksi berhasil ditambahkan (contoh: angka saldo "naik/turun" dengan animasi count-up).
- Dark mode & light mode.
- Responsif penuh (mobile-first, karena pencatatan sering dilakukan on-the-go).
- Sistem "streak" pencatatan (opsional, gamifikasi ringan) untuk mendorong konsistensi harian.

---

## 8. Alur Pengguna (User Flow)

```
Registrasi/Login
   → Onboarding singkat (penjelasan 3 tipe arus kas)
   → Dashboard (dengan data dummy contoh)
   → Klik tombol "+" untuk tambah transaksi
   → Pilih Tipe Arus Kas → Pilih Kategori → Isi Nominal → Simpan
   → Dashboard & chart otomatis ter-update real-time
   → Pengguna bisa cek Riwayat / Laporan kapan saja
```

---

## 9. Data Dummy (Contoh Seed Data)

Data berikut digunakan untuk keperluan demo/onboarding dan pengujian awal (development & QA).

| Tanggal | Tipe Arus Kas | Arah | Kategori | Deskripsi | Nominal (Rp) |
|---|---|---|---|---|---|
| 01/08/2026 | Operasi | Masuk | Gaji | Gaji bulanan Agustus | 8.500.000 |
| 02/08/2026 | Operasi | Keluar | Belanja Harian | Belanja bulanan di supermarket | 750.000 |
| 03/08/2026 | Operasi | Keluar | Transportasi | Isi bensin + tol | 250.000 |
| 04/08/2026 | Investasi | Keluar | Pembelian Saham | Beli saham BBCA 10 lot | 1.200.000 |
| 05/08/2026 | Operasi | Keluar | Makan & Minum | Makan siang & kopi seminggu | 350.000 |
| 06/08/2026 | Pendanaan | Masuk | Pinjaman Masuk | Pinjaman modal usaha dari koperasi | 5.000.000 |
| 07/08/2026 | Operasi | Masuk | Pendapatan Freelance | Proyek desain logo klien | 1.500.000 |
| 08/08/2026 | Operasi | Keluar | Tagihan | Listrik & internet | 450.000 |
| 09/08/2026 | Investasi | Masuk | Pencairan Deposito | Deposito jatuh tempo | 3.000.000 |
| 10/08/2026 | Pendanaan | Keluar | Cicilan Utang | Cicilan KPR bulan Agustus | 2.200.000 |
| 11/08/2026 | Operasi | Keluar | Sewa | Sewa kos bulanan | 1.000.000 |
| 12/08/2026 | Investasi | Keluar | Pembelian Aset | Beli laptop untuk kerja | 9.000.000 |
| 13/08/2026 | Operasi | Masuk | Bonus | Bonus kinerja Q2 | 2.000.000 |
| 14/08/2026 | Pendanaan | Keluar | Bagi Hasil | Bagi hasil ke investor usaha kecil | 500.000 |
| 15/08/2026 | Operasi | Keluar | Belanja Harian | Belanja mingguan | 400.000 |

**Ringkasan Dummy (per 15 Agustus 2026):**

| Tipe Arus Kas | Total Masuk | Total Keluar | Net Cash Flow |
|---|---|---|---|
| Operasi | Rp 12.000.000 | Rp 3.200.000 | **+Rp 8.800.000** |
| Investasi | Rp 3.000.000 | Rp 10.200.000 | **-Rp 7.200.000** |
| Pendanaan | Rp 5.000.000 | Rp 2.700.000 | **+Rp 2.300.000** |
| **Total** | **Rp 20.000.000** | **Rp 16.100.000** | **+Rp 3.900.000** |

---

## 10. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
|---|---|
| **Performa** | Chart harus ter-update dalam < 500ms setelah transaksi disimpan |
| **Keamanan** | Enkripsi password, autentikasi berbasis token (JWT), HTTPS wajib |
| **Skalabilitas** | Backend mampu menangani minimal 10.000 pengguna aktif tanpa degradasi performa |
| **Aksesibilitas** | Kontras warna sesuai standar WCAG AA, mendukung navigasi keyboard |
| **Kompatibilitas** | Responsif di Chrome, Safari, Firefox, Edge; mobile & desktop |
| **Backup Data** | Backup otomatis harian |

---

## 11. Prioritas Pengembangan (Roadmap Singkat)

| Fase | Fitur |
|---|---|
| **MVP (Fase 1)** | Auth, input transaksi, dashboard chart dasar, riwayat transaksi, 3 tipe arus kas |
| **Fase 2** | Laporan arus kas otomatis, filter lanjutan, dark mode, onboarding interaktif |
| **Fase 3** | Export laporan, notifikasi/reminder, target tabungan, multi-akun keluarga |
| **Fase 4** | Integrasi bank/e-wallet, input via foto struk (OCR), aplikasi mobile |

---

## 12. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Pengguna awam bingung dengan istilah akuntansi | Gunakan bahasa sederhana di UI + tooltip edukatif + onboarding |
| Pengguna malas input setiap hari | Desain UI menarik, proses input cepat (<15 detik), gamifikasi streak |
| Data sensitif keuangan bocor | Enkripsi end-to-end untuk data sensitif, audit keamanan berkala |
| Chart lambat saat data besar | Gunakan agregasi data di backend, lazy loading, caching |

---

## 13. Lampiran: Contoh Skema Data Transaksi (untuk tim teknis)

```json
{
  "id": "txn_00123",
  "user_id": "user_001",
  "tanggal": "2026-08-07",
  "tipe_arus_kas": "operasi",      // operasi | investasi | pendanaan
  "arah": "masuk",                  // masuk | keluar
  "kategori": "pendapatan_freelance",
  "deskripsi": "Proyek desain logo klien",
  "nominal": 1500000,
  "created_at": "2026-08-07T10:15:00Z"
}
```
