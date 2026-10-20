/* ============================================================================
 * settings.js
 * ----------------------------------------------------------------------------
 * Pusat data dinamis dari backend (tabel `app_settings` + `tbl_kategori_industri`).
 *
 * - Menyimpan default BAWAAN (nilai lama yang dulu hardcoded) sebagai fallback,
 *   supaya aplikasi tetap berjalan walau DB/endpoint tidak tersedia.
 * - `loadAppSettings()` dipanggil sekali saat startup; hasil di-cache ke
 *   localStorage agar tampilan tidak "berkedip" pada reload berikutnya.
 *
 * Pakai: getSetting('dokumen_defaults.ppn_persen', 11)
 * ==========================================================================*/

(function () {
    const DEFAULTS = {
        company: {
            nama: 'AniTech',
            nama_upper: 'ANITECH',
            alamat: 'Puri Gading Blok J4 No 8 Cluster Vila Ubud, RT002 RW011, Kel. Jatimelati, Kec. Pondok Melati, Kota Bekasi, 17414',
            kontak: '081977241552',
            email: ''
        },
        brands: {
            anitech: {
                id: 'anitech', nama: 'AniTech', nama_upper: 'ANITECH STUDIO',
                alamat: 'Puri Gading Blok J4 No 8 Cluster Vila Ubud, RT002 RW011, Kel. Jatimelati, Kec. Pondok Melati, Kota Bekasi, 17414',
                kontak: '081977241552',
                logo: 'assets/logo/Logo AniTech Transparan.webp',
                bank: [
                    { bank: 'BCA', no: '6872202613', atas: 'Mecca Alain Noor Sheehan' }
                ],
                warna: { r: 30, g: 58, b: 138 }
            },
            klir_by_anitech: {
                id: 'klir_by_anitech', nama: 'KLIR by AniTech', nama_upper: 'KLIR BY ANITECH',
                alamat: 'Puri Gading Blok J4 No 8 Cluster Vila Ubud, RT002 RW011, Kel. Jatimelati, Kec. Pondok Melati, Kota Bekasi, 17414',
                kontak: '081977241552',
                logo: 'assets/logo/[Text Hitam] Logo KLIR V2 Transparan.webp',
                bank: [
                    { bank: 'BCA', no: '6872202613', atas: 'Mecca Alain Noor Sheehan' }
                ],
                warna: { r: 0, g: 0, b: 0 }
            },
            klir: {
                id: 'klir', nama: 'KLIR STUDIO', nama_upper: 'KLIR STUDIO',
                alamat: 'Puri Gading Blok J4 No 8 Cluster Vila Ubud, RT002 RW011, Kel. Jatimelati, Kec. Pondok Melati, Kota Bekasi, 17414',
                kontak: '081977241552',
                logo: 'assets/logo/[Text Hitam] Logo KLIR V2 Transparan.webp',
                bank: [
                    { bank: 'BCA', no: '6872202613', atas: 'Mecca Alain Noor Sheehan' }
                ],
                warna: { r: 0, g: 0, b: 0 }
            }
        },
        dokumen_defaults: {
            ppn_persen: 11,
            ppn_aktif: true,
            diskon_default: 0,
            jatuh_tempo_hari: 14,
            prefix_proposal: 'PRO',
            prefix_invoice: 'INV'
        },
        branding: {
            app_name: 'LeadScout AI',
            app_title: 'UMKM Lead Finder',
            app_tagline: 'Sistem Manajemen Prospek UMKM AI',
            sidebar_title: 'UMKM',
            sidebar_subtitle: 'Lead Finder',
            export_prefix: 'Laporan_Dashboard_AniScout',
            wa_template: 'Halo Bapak/Ibu, berikut kami lampirkan {jenis} {no} dengan total {total}. Dokumen PDF sudah kami kirimkan, silakan dicek. Terima kasih.',
            ai_fallback_template: ''
        },
        lokasi: {
            kota_default: 'Bekasi',
            riwayat_kota_seed: ['Bekasi', 'Jakarta Selatan', 'Bandung']
        },
        kategori: [
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
            { nama: 'Lainnya', ikon: 'ri-more-fill', urutan: 99 }
        ]
    };

    function deepMerge(base, override) {
        if (override === null || override === undefined) return base;
        if (Array.isArray(base) || typeof base !== 'object') return override;
        const out = { ...base };
        for (const key of Object.keys(override)) {
            out[key] = deepMerge(base[key], override[key]);
        }
        return out;
    }

    window.APP_SETTINGS = { ...DEFAULTS, loaded: false };

    // Pakai cache lokal (jika ada) supaya nilai benar tampil sebelum fetch selesai.
    try {
        const cached = JSON.parse(localStorage.getItem('appSettingsCache') || 'null');
        if (cached && typeof cached === 'object') {
            window.APP_SETTINGS = { ...deepMerge(DEFAULTS, cached), loaded: true };
        }
    } catch (e) { /* ignore cache yang rusak */ }

    window.getSetting = function (path, def) {
        const parts = String(path).split('.');
        let cur = window.APP_SETTINGS;
        for (const p of parts) {
            if (cur === null || cur === undefined) return def;
            cur = cur[p];
        }
        return cur === undefined ? def : cur;
    };

    window.loadAppSettings = async function () {
        try {
            const res = await fetch('backend/crm_api.php?action=settings', { cache: 'no-store' });
            const data = await res.json();
            if (data && data.status === 'success' && data.settings) {
                window.APP_SETTINGS = { ...deepMerge(DEFAULTS, data.settings), loaded: true };
                try { localStorage.setItem('appSettingsCache', JSON.stringify(data.settings)); } catch (e) { /* ignore */ }
            }
        } catch (e) {
            /* fallback: pertahankan default/cache */
        }
        return window.APP_SETTINGS;
    };
})();
