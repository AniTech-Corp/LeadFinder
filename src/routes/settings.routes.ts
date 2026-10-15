import { Router, Request, Response } from 'express';
import { pool } from '../config/db.js';

const router = Router();

async function readSettings(): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  const [rows]: [any[], any] = await pool.query('SELECT section, data FROM app_settings');
  for (const r of rows) {
    try {
      out[r.section] = JSON.parse(r.data);
    } catch {
      out[r.section] = r.data;
    }
  }
  return out;
}

async function readKategori(): Promise<any[]> {
  const [rows]: [any[], any] = await pool.query(
    'SELECT id, nama, ikon, urutan FROM tbl_kategori_industri WHERE is_aktif = 1 ORDER BY urutan ASC, id ASC'
  );
  return rows;
}

// GET /api/settings - Semua konten dinamis (company, brands, dokumen_defaults, branding, lokasi, kategori)
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!pool) {
      res.status(503).json({ status: 'error', message: 'Database belum terhubung.' });
      return;
    }
    const settings = await readSettings();
    settings.kategori = await readKategori();
    res.json({ status: 'success', settings });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/settings/kategori - Master kategori industri
router.get('/kategori', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!pool) {
      res.json({ status: 'success', kategori: [] });
      return;
    }
    res.json({ status: 'success', kategori: await readKategori() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/settings/kategori - Tambah Kategori Baru
router.post('/kategori', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!pool) {
      res.status(503).json({ status: 'error', message: 'Database belum terhubung.' });
      return;
    }
    const { nama, ikon } = req.body || {};
    const trimmedNama = String(nama || '').trim();
    if (!trimmedNama) {
      res.status(400).json({ status: 'error', message: 'Nama kategori wajib diisi.' });
      return;
    }
    if (trimmedNama.length > 100) {
      res.status(400).json({ status: 'error', message: 'Nama kategori maksimal 100 karakter.' });
      return;
    }

    // Cek duplikasi nama (case-insensitive)
    const [existing]: [any[], any] = await pool.query(
      'SELECT id FROM tbl_kategori_industri WHERE LOWER(nama) = LOWER(?)',
      [trimmedNama]
    );
    if (existing && existing.length > 0) {
      res.status(400).json({ status: 'error', message: `Kategori "${trimmedNama}" sudah ada.` });
      return;
    }

    const cleanIkon = String(ikon || 'ri-store-2-line').trim();
    const [maxRows]: [any[], any] = await pool.query(
      'SELECT COALESCE(MAX(urutan), 0) + 1 AS next_urutan FROM tbl_kategori_industri'
    );
    const nextUrutan = maxRows[0]?.next_urutan || 1;

    const [result]: any = await pool.query(
      'INSERT INTO tbl_kategori_industri (nama, ikon, urutan, is_aktif) VALUES (?, ?, ?, 1)',
      [trimmedNama, cleanIkon, nextUrutan]
    );

    res.status(201).json({
      status: 'success',
      message: 'Kategori berhasil ditambahkan.',
      kategori: {
        id: result.insertId,
        nama: trimmedNama,
        ikon: cleanIkon,
        urutan: nextUrutan,
        is_aktif: 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PUT /api/settings/kategori/:id - Ubah Kategori
router.put('/kategori/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!pool) {
      res.status(503).json({ status: 'error', message: 'Database belum terhubung.' });
      return;
    }
    const id = parseInt(String(req.params.id || ''), 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'ID kategori tidak valid.' });
      return;
    }
    const { nama, ikon, urutan } = req.body || {};
    const trimmedNama = String(nama || '').trim();
    if (!trimmedNama) {
      res.status(400).json({ status: 'error', message: 'Nama kategori wajib diisi.' });
      return;
    }

    // Ambil data kategori saat ini
    const [currentRows]: [any[], any] = await pool.query(
      'SELECT id, nama, ikon, urutan FROM tbl_kategori_industri WHERE id = ?',
      [id]
    );
    if (!currentRows || currentRows.length === 0) {
      res.status(404).json({ status: 'error', message: 'Kategori tidak ditemukan.' });
      return;
    }
    const oldNama = currentRows[0].nama;

    // Cek duplikasi nama pada kategori lain
    const [dupRows]: [any[], any] = await pool.query(
      'SELECT id FROM tbl_kategori_industri WHERE LOWER(nama) = LOWER(?) AND id != ?',
      [trimmedNama, id]
    );
    if (dupRows && dupRows.length > 0) {
      res.status(400).json({ status: 'error', message: `Nama kategori "${trimmedNama}" sudah digunakan.` });
      return;
    }

    const cleanIkon = ikon !== undefined ? String(ikon).trim() : currentRows[0].ikon;
    const finalUrutan = urutan !== undefined ? parseInt(urutan, 10) : currentRows[0].urutan;

    await pool.query(
      'UPDATE tbl_kategori_industri SET nama = ?, ikon = ?, urutan = ? WHERE id = ?',
      [trimmedNama, cleanIkon, finalUrutan, id]
    );

    // Sinkronkan nama kategori di tabel leads jika nama berubah
    if (oldNama !== trimmedNama) {
      await pool.query('UPDATE leads SET category = ? WHERE category = ?', [trimmedNama, oldNama]);
    }

    res.json({
      status: 'success',
      message: 'Kategori berhasil diperbarui.',
      kategori: {
        id,
        nama: trimmedNama,
        ikon: cleanIkon,
        urutan: finalUrutan,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// DELETE /api/settings/kategori/:id - Hapus Kategori
router.delete('/kategori/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!pool) {
      res.status(503).json({ status: 'error', message: 'Database belum terhubung.' });
      return;
    }
    const id = parseInt(String(req.params.id || ''), 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'ID kategori tidak valid.' });
      return;
    }

    const [rows]: [any[], any] = await pool.query(
      'SELECT id, nama FROM tbl_kategori_industri WHERE id = ?',
      [id]
    );
    if (!rows || rows.length === 0) {
      res.status(404).json({ status: 'error', message: 'Kategori tidak ditemukan.' });
      return;
    }

    await pool.query('DELETE FROM tbl_kategori_industri WHERE id = ?', [id]);

    res.json({
      status: 'success',
      message: `Kategori "${rows[0].nama}" berhasil dihapus.`,
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/settings/status - Status integrasi (tanpa membocorkan secret)
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  const apifyToken = process.env.APIFY_TOKEN || '';
  const aiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || '';
  const aiModel = process.env.AI_MODEL || 'claude-sonnet-4-6-free';
  const aiBaseUrl =
    process.env.AI_BASE_URL ||
    (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.apmix.ai/v1');

  let dbConnected = false;
  try {
    if (pool) {
      await pool.query('SELECT 1');
      dbConnected = true;
    }
  } catch {
    dbConnected = false;
  }

  res.json({
    status: 'success',
    data: {
      db: {
        connected: dbConnected,
        name: process.env.DB_NAME || 'leadscout',
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || '3306',
      },
      apify: {
        configured: !!apifyToken && !apifyToken.startsWith('your_'),
      },
      ai: {
        configured: !!aiKey && !aiKey.startsWith('your_'),
        model: aiModel,
        base_url: aiBaseUrl,
      },
      runtime: {
        node: process.version,
        port: process.env.PORT || '3000',
      },
    },
  });
});

export default router;
