import { Router, Request, Response } from 'express';
import { pool } from '../config/db.js';

const router = Router();

import crypto from 'crypto';

function buildPeriodFilter(period: string = 'all'): { where: string; params: any[] } {
  if (period === 'year_this') {
    return { where: 'YEAR(created_at) = YEAR(CURRENT_DATE())', params: [] };
  }
  if (period === 'year_last') {
    return { where: 'YEAR(created_at) = YEAR(CURRENT_DATE()) - 1', params: [] };
  }
  const monthNum = parseInt(period, 10);
  if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
    return {
      where: 'MONTH(created_at) = ? AND YEAR(created_at) = YEAR(CURRENT_DATE())',
      params: [monthNum],
    };
  }
  return { where: '1=1', params: [] };
}

// GET /api/crm/leads - Ambil semua leads (dengan filter periode)
router.get('/leads', async (req: Request, res: Response): Promise<void> => {
  const period = (req.query.period as string) || 'all';
  const { where, params } = buildPeriodFilter(period);

  try {
    if (!pool) {
      res.json({ status: 'success', data: [] });
      return;
    }
    const [rows]: [any[], any] = await pool.query(`SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC`, params);
    res.json({ status: 'success', data: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/crm/leads - Simpan atau update lead ke database
router.post('/leads', async (req: Request, res: Response): Promise<void> => {
  const input = req.body;
  if (!input || !input.title) {
    res.status(400).json({ error: 'Data prospek tidak valid.' });
    return;
  }

  const cid = input.cid || crypto.createHash('md5').update(`${input.title}-${input.address || ''}`).digest('hex');

  try {
    if (!pool) {
      res.status(500).json({ error: 'Database belum terhubung.' });
      return;
    }

    const sosmedJson = input.sosmed_data
      ? (typeof input.sosmed_data === 'string' ? input.sosmed_data : JSON.stringify(input.sosmed_data))
      : null;

    const query = `
      INSERT INTO leads (cid, title, address, phone, website, ig_url, sosmed_data, industry, score, skala_bisnis, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'tersimpan')
      ON DUPLICATE KEY UPDATE
        title=VALUES(title), address=VALUES(address), phone=VALUES(phone),
        website=VALUES(website), ig_url=VALUES(ig_url),
        sosmed_data=COALESCE(VALUES(sosmed_data), sosmed_data),
        skala_bisnis=VALUES(skala_bisnis),
        industry=VALUES(industry), score=VALUES(score);
    `;

    await pool.query(query, [
      cid,
      input.title || '',
      input.address || '',
      input.phone || '',
      input.website || '',
      input.ig_url || '',
      sosmedJson,
      input.industry || 'UMKM',
      input.score || 50,
      input.skala_bisnis || 'Kecil',
    ]);

    res.json({ status: 'success', cid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/crm/update-status - Update status tahapan sales
router.post('/update-status', async (req: Request, res: Response): Promise<void> => {
  const { cid, status } = req.body;
  if (!cid || !status) {
    res.status(400).json({ error: 'Parameter cid dan status wajib disertakan.' });
    return;
  }

  try {
    if (!pool) {
      res.status(500).json({ error: 'Database belum terhubung.' });
      return;
    }
    await pool.query('UPDATE leads SET status = ? WHERE cid = ?', [status, cid]);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/crm/update-jadwal - Update jadwal tindakan/follow-up
router.post('/update-jadwal', async (req: Request, res: Response): Promise<void> => {
  const { cid, jadwal } = req.body;
  if (!cid || !jadwal) {
    res.status(400).json({ error: 'Parameter cid dan jadwal wajib disertakan.' });
    return;
  }

  try {
    if (!pool) {
      res.status(500).json({ error: 'Database belum terhubung.' });
      return;
    }
    await pool.query('UPDATE leads SET jadwal_action = ? WHERE cid = ?', [jadwal, cid]);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/crm/dashboard-stats - Metrik statistik analitik
router.get('/dashboard-stats', async (req: Request, res: Response): Promise<void> => {
  const period = (req.query.period as string) || 'all';

  const { where, params } = buildPeriodFilter(period);

  try {
    if (!pool) {
      res.json({
        status: 'success',
        data: {
          total: 0,
          follow_up: 0,
          demo: 0,
          closing: 0,
          industry: {},
          priority: { tinggi: 0, menengah: 0, rendah: 0 },
          jadwal_hari_ini: [],
        },
      });
      return;
    }

    // 1. Total Leads
    const [totalRows]: [any[], any] = await pool.query(`SELECT COUNT(*) as total FROM leads WHERE ${where}`, params);
    const total = totalRows[0]?.total || 0;

    // 2. Status counts
    const [statusRows]: [any[], any] = await pool.query(
      `SELECT status, COUNT(*) as count FROM leads WHERE ${where} GROUP BY status`,
      params
    );
    const statusMap: Record<string, number> = {};
    for (const r of statusRows) {
      statusMap[r.status] = r.count;
    }

    const followUp = statusMap['follow_up'] || 0;
    const demo = statusMap['demo'] || 0;
    const closing = (statusMap['closing'] || 0) + (statusMap['selesai'] || 0) + (statusMap['antrian'] || 0);

    // 3. Industry counts
    const [indRows]: [any[], any] = await pool.query(
      `SELECT industry, COUNT(*) as count FROM leads WHERE ${where} GROUP BY industry`,
      params
    );
    const industryCounts: Record<string, number> = {};
    for (const r of indRows) {
      industryCounts[r.industry] = r.count;
    }

    // 4. Priority counts
    const [priorityRows]: [any[], any] = await pool.query(
      `SELECT
        SUM(CASE WHEN score >= 70 THEN 1 ELSE 0 END) as tinggi,
        SUM(CASE WHEN score >= 50 AND score < 70 THEN 1 ELSE 0 END) as menengah,
        SUM(CASE WHEN score < 50 THEN 1 ELSE 0 END) as rendah
      FROM leads WHERE ${where}`,
      params
    );
    const pRow = priorityRows[0] || {};

    // 5. Jadwal Hari Ini
    const [jadwalRows]: [any[], any] = await pool.query(
      `SELECT title, jadwal_action, status, phone FROM leads WHERE jadwal_action LIKE CONCAT(CURRENT_DATE(), '%') ORDER BY jadwal_action ASC`
    );

    res.json({
      status: 'success',
      data: {
        total,
        follow_up: followUp,
        demo,
        closing,
        industry: industryCounts,
        priority: {
          tinggi: parseInt(pRow.tinggi || '0', 10),
          menengah: parseInt(pRow.menengah || '0', 10),
          rendah: parseInt(pRow.rendah || '0', 10),
        },
        jadwal_hari_ini: jadwalRows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/crm/catalog - Katalog paket layanan + master fitur opsional
router.get('/catalog', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!pool) {
      res.json({ status: 'success', katalog: [], fitur_opsional: [] });
      return;
    }
    const [katalog]: [any[], any] = await pool.query(
      'SELECT id_layanan, nama_paket, deskripsi_fitur, estimasi_hari, harga FROM tbl_katalog_layanan ORDER BY id_layanan ASC'
    );
    const [fitur]: [any[], any] = await pool.query(
      'SELECT id_fitur, nama_fitur, harga, kategori FROM tbl_fitur_opsional WHERE is_aktif = 1 ORDER BY kategori ASC, id_fitur ASC'
    );
    res.json({ status: 'success', katalog, fitur_opsional: fitur });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/crm/dokumen - Daftar dokumen Proposal/Invoice untuk tabel administrasi
router.get('/dokumen', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!pool) {
      res.json({ status: 'success', data: [] });
      return;
    }
    const [rows]: [any[], any] = await pool.query(
      `SELECT d.no_dokumen, d.cid, d.jenis, d.id_layanan, d.rincian_fitur, d.catatan,
              d.total_tagihan, d.status_bayar, d.tanggal_cetak,
              l.title, l.industry, l.address, l.phone
       FROM tbl_dokumen d
       LEFT JOIN leads l ON l.cid = d.cid
       ORDER BY d.tanggal_cetak DESC`
    );
    res.json({ status: 'success', data: rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/crm/dokumen - Simpan Proposal/Invoice (rincian dihitung ulang & disimpan di server)
// Bila body berisi `no_dokumen` -> mode EDIT (UPDATE baris yang sama, tidak membuat dokumen baru).
router.post('/dokumen', async (req: Request, res: Response): Promise<void> => {
  const input = req.body || {};
  const cid = input.cid || '';
  const jenis = String(input.jenis || '').toLowerCase();
  const idLayanan = input.id_layanan ?? '';
  const termin = input.termin || 'full';
  const catatan = String(input.catatan || '').trim();
  const fiturInput: any[] = Array.isArray(input.fitur) ? input.fitur : [];

  // Field rincian (diskon/PPN/qty/brand/jatuh tempo/nomor seri) kini ikut disimpan.
  const qtyPaket = parseInt(input.qty, 10) || 1;
  const satuanPaket = String(input.satuan || 'Paket').trim() || 'Paket';
  const diskon = parseFloat(input.diskon) || 0;
  const ppnAktif = input.ppn_aktif !== false;
  const ppnPersen = ppnAktif ? (parseFloat(input.ppn_persen) || 0) : 0;
  const jatuhTempo = input.jatuh_tempo || null;
  const brandId = String(input.brand || 'anitech');
  const editNoDokumen = input.no_dokumen ? String(input.no_dokumen) : null;
  const noSeriInput = input.no_seri ? String(input.no_seri) : null;

  if (!cid || !['proposal', 'invoice'].includes(jenis) || !idLayanan) {
    res.status(400).json({ status: 'error', message: 'Parameter tidak lengkap' });
    return;
  }

  try {
    if (!pool) {
      res.status(500).json({ status: 'error', message: 'Database belum terhubung.' });
      return;
    }

    // 1. Ambil data klien
    const [leadRows]: [any[], any] = await pool.query('SELECT * FROM leads WHERE cid = ?', [cid]);
    const lead = leadRows[0];
    if (!lead) {
      res.status(404).json({ status: 'error', message: 'Klien tidak ditemukan' });
      return;
    }

    // 2. Ambil data paket
    const [layananRows]: [any[], any] = await pool.query(
      'SELECT * FROM tbl_katalog_layanan WHERE id_layanan = ?',
      [idLayanan]
    );
    const layanan = layananRows[0];
    if (!layanan) {
      res.status(404).json({ status: 'error', message: 'Paket layanan tidak ditemukan' });
      return;
    }

    // 3. Resolve fitur opsional: master diambil harganya dari DB, manual dari input
    const rincianFitur: any[] = [];
    let subtotalFitur = 0;
    for (const f of fiturInput) {
      let idFitur: number | null = null;
      let nama = '';
      let hargaF = 0;
      let manual = false;

      if (f && f.id_fitur) {
        const [fr]: [any[], any] = await pool.query(
          'SELECT id_fitur, nama_fitur, harga FROM tbl_fitur_opsional WHERE id_fitur = ?',
          [f.id_fitur]
        );
        const row = fr[0];
        if (!row) continue;
        idFitur = parseInt(row.id_fitur, 10);
        nama = row.nama_fitur;
        hargaF = parseFloat(row.harga) || 0;
      } else if (f && f.nama) {
        nama = String(f.nama).trim();
        hargaF = parseFloat(f.harga) || 0;
        manual = true;
      } else {
        continue;
      }

      const qtyF = parseInt(f.qty, 10) || 1;
      const satuanF = (f.satuan && String(f.satuan).trim()) || 'Paket';
      const lineTotal = hargaF * qtyF;
      rincianFitur.push({ id_fitur: idFitur, nama, harga: hargaF, qty: qtyF, satuan: satuanF, manual, total: lineTotal });
      subtotalFitur += lineTotal;
    }

    // 4. Hitung rincian harga (authoritative di server)
    const hargaPaket = parseFloat(layanan.harga) || 0;
    const subtotalPaket = hargaPaket * qtyPaket;
    const subtotal = subtotalPaket + subtotalFitur;
    const ppnNominal = Math.round(((subtotal - diskon) * ppnPersen) / 100);
    const grandTotal = subtotal - diskon + ppnNominal;

    const jenisLabel = jenis === 'invoice' ? 'Invoice' : 'Proposal';
    let statusBayar = 'Belum Bayar';
    let tagihan = grandTotal;
    if (jenis === 'invoice' && termin === 'dp') {
      tagihan = Math.round(grandTotal * 0.5);
      statusBayar = 'DP';
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ym = `${now.getFullYear()}${pad(now.getMonth() + 1)}`;
    const noDokumen = editNoDokumen || `${jenis.toUpperCase().slice(0, 3)}-${ym}-${Math.floor(1000 + Math.random() * 9000)}`;
    const tanggal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const rincianObj = {
      paket: {
        id_layanan: parseInt(String(idLayanan), 10),
        nama: layanan.nama_paket,
        deskripsi: layanan.deskripsi_fitur,
        estimasi_hari: layanan.estimasi_hari,
        harga: hargaPaket,
        qty: qtyPaket,
        satuan: satuanPaket,
      },
      fitur: rincianFitur,
      termin,
      subtotal_paket: subtotalPaket,
      subtotal_fitur: subtotalFitur,
      subtotal,
      diskon,
      ppn_aktif: ppnAktif,
      ppn_persen: ppnPersen,
      ppn_nominal: ppnNominal,
      grand_total: grandTotal,
      no_seri: noSeriInput,
      brand: brandId,
      jatuh_tempo: jatuhTempo,
    };
    const rincianJson = JSON.stringify(rincianObj);

    // 5. Simpan/Perbarui record dokumen di tbl_dokumen
    if (editNoDokumen) {
      const [existing]: [any[], any] = await pool.query(
        'SELECT no_dokumen FROM tbl_dokumen WHERE no_dokumen = ?',
        [editNoDokumen]
      );
      if (existing && existing.length) {
        await pool.query(
          `UPDATE tbl_dokumen
              SET cid = ?, jenis = ?, id_layanan = ?, rincian_fitur = ?, catatan = ?,
                  total_tagihan = ?, status_bayar = ?, tanggal_cetak = ?
            WHERE no_dokumen = ?`,
          [cid, jenisLabel, idLayanan, rincianJson, catatan || null, tagihan, statusBayar, tanggal, editNoDokumen]
        );
      } else {
        await pool.query(
          `INSERT INTO tbl_dokumen (no_dokumen, cid, jenis, id_layanan, rincian_fitur, catatan, total_tagihan, status_bayar, tanggal_cetak)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [editNoDokumen, cid, jenisLabel, idLayanan, rincianJson, catatan || null, tagihan, statusBayar, tanggal]
        );
      }
    } else {
      await pool.query(
        `INSERT INTO tbl_dokumen (no_dokumen, cid, jenis, id_layanan, rincian_fitur, catatan, total_tagihan, status_bayar, tanggal_cetak)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [noDokumen, cid, jenisLabel, idLayanan, rincianJson, catatan || null, tagihan, statusBayar, tanggal]
      );
    }

    res.json({
      status: 'success',
      dokumen: {
        no_dokumen: noDokumen,
        no_seri: noSeriInput,
        brand: brandId,
        tanggal,
        jenis: jenisLabel,
        termin,
        status_bayar: statusBayar,
        catatan,
        total_tagihan: tagihan,
        subtotal,
        subtotal_paket: subtotalPaket,
        subtotal_fitur: subtotalFitur,
        diskon,
        ppn_persen: ppnPersen,
        ppn_nominal: ppnNominal,
        grand_total: grandTotal,
        jatuh_tempo: jatuhTempo,
        paket: {
          id_layanan: parseInt(String(idLayanan), 10),
          nama: layanan.nama_paket,
          deskripsi: layanan.deskripsi_fitur,
          estimasi_hari: layanan.estimasi_hari,
          harga: hargaPaket,
        },
        fitur: rincianFitur,
        klien: { cid: lead.cid, nama: lead.title, alamat: lead.address, telepon: lead.phone },
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
