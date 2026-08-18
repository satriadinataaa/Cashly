const TYPES = ['operasi', 'investasi', 'pendanaan'];
const DIRECTIONS = ['masuk', 'keluar'];

const TYPE_LABELS = {
  operasi: 'Uang sehari-hari',
  investasi: 'Investasi & aset',
  pendanaan: 'Utang & modal',
};

const PURPOSES = [
  { value: 'operasi_keseharian', tipe: 'operasi', label: 'Kebutuhan sehari-hari' },
  { value: 'operasi_rumah', tipe: 'operasi', label: 'Rumah tangga & tagihan' },
  { value: 'operasi_kerja', tipe: 'operasi', label: 'Pekerjaan & usaha' },
  { value: 'operasi_kesehatan', tipe: 'operasi', label: 'Kesehatan & pendidikan' },
  { value: 'operasi_gaya_hidup', tipe: 'operasi', label: 'Hiburan & gaya hidup' },
  { value: 'investasi_instrumen', tipe: 'investasi', label: 'Investasi keuangan' },
  { value: 'investasi_aset', tipe: 'investasi', label: 'Aset & properti' },
  { value: 'investasi_usaha', tipe: 'investasi', label: 'Pengembangan usaha' },
  { value: 'pendanaan_utang', tipe: 'pendanaan', label: 'Pinjaman & cicilan' },
  { value: 'pendanaan_modal', tipe: 'pendanaan', label: 'Modal & bagi hasil' },
];

const CATEGORIES = {
  operasi_keseharian: {
    masuk: ['Cashback Belanja', 'Pengembalian Dana', 'Hadiah Tunai', 'Uang Saku', 'Pendapatan Lain-lain'],
    keluar: ['Belanja Harian', 'Makan & Minum', 'Transportasi Umum', 'Bensin', 'Parkir & Tol', 'Belanja Pakaian', 'Perawatan Diri', 'Kebutuhan Anak', 'Donasi', 'Lain-lain'],
  },
  operasi_rumah: {
    masuk: ['Pendapatan Sewa', 'Penggantian Biaya Rumah', 'Iuran Rumah Tangga Masuk', 'Pendapatan Rumah Lainnya'],
    keluar: ['Tagihan Listrik', 'Tagihan Air', 'Gas Rumah Tangga', 'Internet & Pulsa', 'Sewa/Kos', 'Iuran Lingkungan', 'Perawatan Rumah', 'Perabot Rumah', 'Keamanan & Kebersihan', 'Lain-lain'],
  },
  operasi_kerja: {
    masuk: ['Gaji', 'Pendapatan Freelance', 'Pendapatan Usaha', 'Bonus', 'Tunjangan', 'Komisi', 'Uang Lembur', 'Penjualan Produk', 'Pendapatan Jasa', 'Royalti'],
    keluar: ['Bahan Baku', 'Biaya Operasional Usaha', 'Gaji Karyawan', 'Sewa Tempat Usaha', 'Peralatan Kerja', 'Perjalanan Dinas', 'Pemasaran & Iklan', 'Pajak Usaha', 'Software Kerja', 'Lain-lain'],
  },
  operasi_kesehatan: {
    masuk: ['Klaim Asuransi Kesehatan', 'Beasiswa', 'Penggantian Biaya Medis', 'Bantuan Pendidikan', 'Pendapatan Lainnya'],
    keluar: ['Dokter & Rumah Sakit', 'Obat & Apotek', 'Asuransi Kesehatan', 'Olahraga & Kebugaran', 'Uang Sekolah/Kuliah', 'Buku & Alat Tulis', 'Kursus & Pelatihan', 'Les Privat', 'Sertifikasi', 'Lain-lain'],
  },
  operasi_gaya_hidup: {
    masuk: ['Hadiah Hiburan', 'Refund Tiket', 'Pendapatan Konten', 'Penjualan Barang Hobi', 'Pendapatan Lainnya'],
    keluar: ['Hiburan', 'Liburan', 'Hobi', 'Kafe & Restoran', 'Langganan Digital', 'Game', 'Konser & Acara', 'Elektronik Konsumtif', 'Hadiah untuk Orang Lain', 'Lain-lain'],
  },
  investasi_instrumen: {
    masuk: ['Penjualan Saham', 'Penjualan Reksadana', 'Penjualan Emas', 'Pencairan Deposito', 'Penjualan Kripto', 'Dividen Investasi', 'Kupon Obligasi', 'Pengembalian Investasi'],
    keluar: ['Pembelian Saham', 'Pembelian Reksadana', 'Pembelian Emas', 'Deposito', 'Pembelian Kripto', 'Pembelian Obligasi', 'Biaya Broker', 'Investasi Lain-lain'],
  },
  investasi_aset: {
    masuk: ['Penjualan Properti', 'Penjualan Kendaraan', 'Penjualan Elektronik', 'Penjualan Tanah', 'Pendapatan Penjualan Aset Lainnya'],
    keluar: ['Pembelian Properti', 'Pembelian Kendaraan', 'Pembelian Tanah', 'Pembelian Elektronik', 'Pembelian Peralatan Kerja', 'Renovasi Aset', 'Biaya Legal Aset', 'Aset Lain-lain'],
  },
  investasi_usaha: {
    masuk: ['Penjualan Kepemilikan Usaha', 'Pengembalian Penyertaan Modal', 'Penjualan Aset Usaha', 'Hasil Investasi Usaha', 'Pendapatan Investasi Lainnya'],
    keluar: ['Penyertaan Modal Usaha', 'Pembelian Aset Usaha', 'Pembukaan Cabang', 'Pengembangan Produk', 'Akuisisi Usaha', 'Riset & Pengembangan', 'Investasi Usaha Lainnya'],
  },
  pendanaan_utang: {
    masuk: ['Pinjaman Bank', 'Pinjaman Koperasi', 'Pinjaman Keluarga/Teman', 'Pencairan Kartu Kredit', 'Pinjaman Online', 'Refinancing Utang', 'Pinjaman Lainnya'],
    keluar: ['Cicilan KPR', 'Cicilan Kendaraan', 'Cicilan Kartu Kredit', 'Pembayaran Pinjaman Bank', 'Pembayaran Pinjaman Pribadi', 'Pelunasan Utang', 'Bunga Pinjaman', 'Biaya Administrasi Pinjaman', 'Pembayaran Utang Lainnya'],
  },
  pendanaan_modal: {
    masuk: ['Modal Investor', 'Modal Keluarga', 'Penambahan Modal Pribadi', 'Pendanaan Usaha', 'Setoran Pemilik', 'Modal Lainnya'],
    keluar: ['Bagi Hasil', 'Dividen Pemilik', 'Pengembalian Modal', 'Penarikan Modal Pemilik', 'Pembelian Kembali Kepemilikan', 'Distribusi Modal Lainnya'],
  },
};

module.exports = { TYPES, DIRECTIONS, TYPE_LABELS, PURPOSES, CATEGORIES };
