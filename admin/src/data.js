export const metrics = [
  { label: 'Total pengguna', value: '12.847', trend: '+12,5%', note: 'vs. bulan lalu', icon: 'users', tone: 'green' },
  { label: 'Pengguna aktif', value: '8.492', trend: '+8,2%', note: '66,1% dari total', icon: 'pulse', tone: 'blue' },
  { label: 'Total transaksi', value: '248.920', trend: '+18,7%', note: 'bulan ini', icon: 'receipt', tone: 'purple' },
  { label: 'Volume transaksi', value: 'Rp 8,4 M', trend: '+15,3%', note: 'bulan ini', icon: 'wallet', tone: 'orange' },
];

export const growth = {
  labels: ['Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu'],
  active: [4700, 5200, 5450, 6400, 6850, 7600, 8492],
  newUsers: [2800, 3300, 3100, 4050, 4400, 4950, 5700],
};

export const health = [
  { label: 'Sehat', value: 67, count: '5.690', color: '#287557' },
  { label: 'Perlu perhatian', value: 24, count: '2.038', color: '#e6ad52' },
  { label: 'Berisiko', value: 9, count: '764', color: '#dc7668' },
];

export const categories = [
  { name: 'Makanan & Minuman', icon: 'food', amount: 'Rp 1,82 M', count: '62.840 transaksi', percent: 86, color: '#2f8060' },
  { name: 'Transportasi', icon: 'car', amount: 'Rp 1,24 M', count: '41.230 transaksi', percent: 65, color: '#638bb1' },
  { name: 'Belanja', icon: 'bag', amount: 'Rp 986 Jt', count: '35.192 transaksi', percent: 51, color: '#8c7bbb' },
  { name: 'Tagihan & Utilitas', icon: 'bolt', amount: 'Rp 742 Jt', count: '28.615 transaksi', percent: 38, color: '#d49b44' },
];

export const activities = [
  { icon: 'userPlus', tone: 'green', title: 'Pengguna baru terdaftar', text: 'Dewi Kartika bergabung dengan Cashly', time: '2 menit lalu' },
  { icon: 'alert', tone: 'orange', title: 'Lonjakan transaksi terdeteksi', text: 'Volume transaksi naik 32% dalam 1 jam', time: '18 menit lalu' },
  { icon: 'target', tone: 'purple', title: 'Target bulanan tercapai', text: '12.000 pengguna telah terlampaui', time: '1 jam lalu' },
  { icon: 'check', tone: 'blue', title: 'Laporan sistem selesai', text: 'Rekonsiliasi harian berhasil diproses', time: '3 jam lalu' },
];
