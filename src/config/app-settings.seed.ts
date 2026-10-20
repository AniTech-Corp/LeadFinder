/**
 * Default/seed untuk konten dinamis (tabel `app_settings`) & master kategori.
 *
 * Nilai di sini SAMA PERSIS dengan yang sebelumnya di-hardcode di frontend,
 * supaya perilaku aplikasi tidak berubah setelah migrasi ke backend.
 * Ubah nilai di DB (tabel app_settings / tbl_kategori_industri) untuk
 * menyesuaikan tanpa perlu mengubah kode.
 */

export const DEFAULT_CATEGORIES: Array<{ nama: string; ikon: string; urutan: number }> = [
  { nama: 'Kuliner', ikon: 'ri-restaurant-line', urutan: 1 },
  { nama: 'Fashion', ikon: 'ri-shopping-bag-3-line', urutan: 2 },
  { nama: 'Kecantikan', ikon: 'ri-sparkling-fill', urutan: 3 },
  { nama: 'Laundry', ikon: 'ri-t-shirt-line', urutan: 4 },
  { nama: 'Toko Retail', ikon: 'ri-store-3-line', urutan: 5 },
  { nama: 'Florist', ikon: 'ri-plant-line', urutan: 6 },
  { nama: 'Catering', ikon: 'ri-cup-line', urutan: 7 },
  { nama: 'Percetakan', ikon: 'ri-printer-line', urutan: 8 },
  { nama: 'Photobox', ikon: 'ri-camera-3-line', urutan: 9 },
  { nama: 'Jasa', ikon: 'ri-tools-line', urutan: 10 },
  { nama: 'Lainnya', ikon: 'ri-more-fill', urutan: 99 },
];

const SHARED_ADDRESS =
  'Puri Gading Blok J4 No 8 Cluster Vila Ubud, RT002 RW011, Kel. Jatimelati, Kec. Pondok Melati, Kota Bekasi, 17414';
const SHARED_KONTAK = '081977241552';

const makeBank = () => [
  { bank: 'BCA', no: '6872202613', atas: 'Mecca Alain Noor Sheehan' },
];

export const DEFAULT_BRANDS: Record<string, any> = {
  anitech: {
    id: 'anitech',
    nama: 'AniTech',
    nama_upper: 'ANITECH STUDIO',
    alamat: SHARED_ADDRESS,
    kontak: SHARED_KONTAK,
    logo: 'assets/logo/Logo AniTech Transparan.webp',
    bank: makeBank(),
    warna: { r: 30, g: 58, b: 138 }, // #1e3a8a
  },
  klir_by_anitech: {
    id: 'klir_by_anitech',
    nama: 'KLIR by AniTech',
    nama_upper: 'KLIR BY ANITECH',
    alamat: SHARED_ADDRESS,
    kontak: SHARED_KONTAK,
    logo: 'assets/logo/[Text Hitam] Logo KLIR V2 Transparan.webp',
    bank: makeBank(),
    warna: { r: 0, g: 0, b: 0 },
  },
  klir: {
    id: 'klir',
    nama: 'KLIR STUDIO',
    nama_upper: 'KLIR STUDIO',
    alamat: SHARED_ADDRESS,
    kontak: SHARED_KONTAK,
    logo: 'assets/logo/[Text Hitam] Logo KLIR V2 Transparan.webp',
    bank: makeBank(),
    warna: { r: 0, g: 0, b: 0 },
  },
};

export const DEFAULT_SETTINGS: Record<string, any> = {
  company: {
    nama: 'AniTech',
    nama_upper: 'ANITECH',
    alamat: SHARED_ADDRESS,
    kontak: SHARED_KONTAK,
    email: '',
  },
  brands: DEFAULT_BRANDS,
  dokumen_defaults: {
    ppn_persen: 11,
    ppn_aktif: true,
    diskon_default: 0,
    jatuh_tempo_hari: 14,
    prefix_proposal: 'PRO',
    prefix_invoice: 'INV',
  },
  branding: {
    app_name: 'LeadScout AI',
    app_title: 'UMKM Lead Finder',
    app_tagline: 'Sistem Manajemen Prospek UMKM AI',
    sidebar_title: 'UMKM',
    sidebar_subtitle: 'Lead Finder',
    export_prefix: 'Laporan_Dashboard_AniScout',
    wa_template:
      'Halo Bapak/Ibu, berikut kami lampirkan {jenis} {no} dengan total {total}. Dokumen PDF sudah kami kirimkan, silakan dicek. Terima kasih.',
    ai_fallback_template:
      'Halo, perkenalkan saya dari tim digital agency Anitech.\n\nSaya menemukan profil *{nama}* di Google Maps dan melihat potensinya sangat luar biasa!\n\nNamun saya perhatikan saat ini *{nama}* belum memaksimalkan *{masalah}*. Di era sekarang, memiliki saluran digital resmi sangat krusial untuk menarik pelanggan baru di sekitar lokasi usaha.\n\nKami memiliki solusi _{solusi}_ yang dapat membantu meningkatkan kunjungan dan omzet hingga 3x lipat. Apakah Bapak/Ibu berkenan jika saya kirimkan portofolio singkat kami?',
  },
  lokasi: {
    kota_default: 'Bekasi',
    riwayat_kota_seed: ['Bekasi', 'Jakarta Selatan', 'Bandung'],
  },
};
