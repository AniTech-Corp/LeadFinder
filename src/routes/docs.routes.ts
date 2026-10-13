import { Router, Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../config/db.js';
import { generatePdfDocument } from '../services/pdf.service.js';

const router = Router();
const upload = multer();

// GET /api/docs/katalog - Daftar paket layanan
router.get('/katalog', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!pool) {
      res.json({ status: 'success', data: [] });
      return;
    }
    const [rows]: [any[], any] = await pool.query('SELECT * FROM tbl_katalog_layanan ORDER BY id_layanan ASC');
    res.json({ status: 'success', data: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/docs/generate-pdf - Generate dokumen Proposal atau Invoice
router.post('/generate-pdf', upload.none(), async (req: Request, res: Response): Promise<void> => {
  const { cid, jenis, id_layanan, termin } = req.body;

  if (!cid || !jenis || !id_layanan) {
    res.status(400).json({ status: 'error', message: 'Parameter cid, jenis, dan id_layanan wajib diisi.' });
    return;
  }

  try {
    if (!pool) {
      res.status(500).json({ status: 'error', message: 'Database belum terhubung.' });
      return;
    }

    // 1. Fetch Lead
    const [leadRows]: [any[], any] = await pool.query('SELECT * FROM leads WHERE cid = ?', [cid]);
    const lead = leadRows[0];
    if (!lead) {
      res.status(404).json({ status: 'error', message: 'Data prospek tidak ditemukan.' });
      return;
    }

    // 2. Fetch Layanan
    const [layananRows]: [any[], any] = await pool.query('SELECT * FROM tbl_katalog_layanan WHERE id_layanan = ?', [id_layanan]);
    const layanan = layananRows[0];
    if (!layanan) {
      res.status(404).json({ status: 'error', message: 'Paket layanan tidak ditemukan.' });
      return;
    }

    const hargaTotal = parseFloat(layanan.harga);
    let tagihanAktif = hargaTotal;
    let statusBayar = 'Belum Bayar';

    if (jenis === 'invoice' && termin === 'dp') {
      tagihanAktif = hargaTotal * 0.5;
      statusBayar = 'DP';
    }

    const noDokumen = `${jenis.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Simpan record dokumen ke tbl_dokumen
    await pool.query(
      `INSERT INTO tbl_dokumen (no_dokumen, cid, jenis, id_layanan, total_tagihan, status_bayar)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE total_tagihan=VALUES(total_tagihan), status_bayar=VALUES(status_bayar);`,
      [noDokumen, cid, jenis === 'invoice' ? 'Invoice' : 'Proposal', id_layanan, tagihanAktif, statusBayar]
    );

    // 4. Generate PDF file
    const pdfResult = await generatePdfDocument({
      noDokumen,
      jenis: jenis as 'proposal' | 'invoice',
      leadTitle: lead.title,
      leadAddress: lead.address,
      leadPhone: lead.phone,
      namaPaket: layanan.nama_paket,
      deskripsiFitur: layanan.deskripsi_fitur,
      estimasiHari: layanan.estimasi_hari,
      totalHarga: hargaTotal,
      tagihanAktif,
      termin: termin || 'full',
      statusBayar,
    });

    res.json({
      status: 'success',
      file_url: pdfResult.fileUrl,
      filename: pdfResult.fileName,
      no_dokumen: noDokumen,
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
