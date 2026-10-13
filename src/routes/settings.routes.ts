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
