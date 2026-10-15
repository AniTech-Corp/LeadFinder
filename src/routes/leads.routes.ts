import { Router, Request, Response } from 'express';
import { scrapeGooglePlacesViaApify } from '../services/apify.service.js';
import { runDeepHunt } from '../services/deephunt.service.js';
import { generateWhatsAppPitch, detectBusinessSocialMedia } from '../services/ai.service.js';
import { pool } from '../config/db.js';

const router = Router();

// POST /api/leads/search - Pencarian Google Maps via Apify
router.post('/search', async (req: Request, res: Response): Promise<void> => {
  const { q, category, maxPlaces } = req.body;

  if (!q) {
    res.status(400).json({ error: 'Kata kunci pencarian (q) wajib diisi.' });
    return;
  }

  try {
    const places = await scrapeGooglePlacesViaApify(q, category || 'UMKM', maxPlaces || 20);
    res.json({ status: 'success', places });
  } catch (error: any) {
    console.error('[Leads Route Error]', error.message);
    res.status(500).json({
      error: error.message || 'Gagal melakukan scraping via Apify.',
      places: [],
    });
  }
});

// POST /api/leads/deephunt - Analisis website, WA, sosmed, dan skala bisnis
router.post('/deephunt', async (req: Request, res: Response): Promise<void> => {
  const { website, phone } = req.body;
  try {
    const result = await runDeepHunt(website, phone);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/leads/ai-draft - Generator copywriting pitch WhatsApp via LLM
router.post('/ai-draft', async (req: Request, res: Response): Promise<void> => {
  const { nama, missing } = req.body;
  try {
    const draft = await generateWhatsAppPitch(nama || 'Pemilik Usaha', missing || []);
    res.json({ status: 'success', draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/leads/detect-sosmed - Deteksi sosial media (Instagram, TikTok, Facebook, WA, Maps) via AI & Bio link crawler
router.post('/detect-sosmed', async (req: Request, res: Response): Promise<void> => {
  const { title, address, phone, website, category, mapsUrl, cid } = req.body || {};
  if (!title) {
    res.status(400).json({ error: 'Nama bisnis (title) wajib disertakan.' });
    return;
  }

  try {
    const sosmed = await detectBusinessSocialMedia({
      title,
      address,
      phone,
      website,
      category,
      mapsUrl,
    });

    if (cid && pool) {
      try {
        await pool.query(
          `UPDATE leads SET sosmed_data = ?, ig_url = COALESCE(?, ig_url) WHERE cid = ?`,
          [JSON.stringify(sosmed), sosmed.instagram, cid]
        );
      } catch (err: any) {
        console.warn('[Update Lead Sosmed Error]', err.message);
      }
    }

    res.json({ status: 'success', sosmed });
  } catch (error: any) {
    console.error('[Detect Sosmed Route Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;

