import { Router, Request, Response } from 'express';
import { scrapeGooglePlacesViaApify } from '../services/apify.service.js';
import { runDeepHunt } from '../services/deephunt.service.js';
import { generateWhatsAppPitch } from '../services/ai.service.js';

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

export default router;
