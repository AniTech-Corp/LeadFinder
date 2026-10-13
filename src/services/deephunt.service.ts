import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

export interface DeepHuntResult {
  hasWa: boolean;
  hasIg: boolean;
  hasFb: boolean;
  hasTiktok: boolean;
  hasX: boolean;
  scale: 'Kecil' | 'Menengah' | 'Besar';
  igUrl?: string;
  error?: string | null;
}

export async function runDeepHunt(website?: string | null, phone?: string | null): Promise<DeepHuntResult> {
  const result: DeepHuntResult = {
    hasWa: false,
    hasIg: false,
    hasFb: false,
    hasTiktok: false,
    hasX: false,
    scale: 'Kecil',
    error: null,
  };

  // 1. Cek No. Telepon apakah nomor HP Indonesia (potensi WhatsApp tinggi)
  if (phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('628') || cleanPhone.startsWith('08')) {
      result.hasWa = true;
    }
  }

  // 2. Crawl website jika ada
  if (website) {
    let url = website.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const response = await axios.get(url, {
        timeout: 6000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxRedirects: 3,
        validateStatus: (status) => status < 400,
      });

      const html = response.data;
      if (typeof html === 'string') {
        const $ = cheerio.load(html);

        // Cari link WA
        const waLinks = $('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp://"]');
        if (waLinks.length > 0) result.hasWa = true;

        // Cari link Instagram
        const igLink = $('a[href*="instagram.com"]').first().attr('href');
        if (igLink) {
          result.hasIg = true;
          result.igUrl = igLink;
        }

        // Cari Facebook
        if ($('a[href*="facebook.com"]').length > 0) result.hasFb = true;

        // Cari TikTok
        if ($('a[href*="tiktok.com"]').length > 0) result.hasTiktok = true;

        // Cari Twitter / X
        if ($('a[href*="twitter.com"], a[href*="x.com"]').length > 0) result.hasX = true;

        // Deteksi Skala Bisnis (Heuristik Teks)
        const text = $('body').text();
        if (/\b(PT\.?|Tbk\.?|nasional|karir|investor|banyak cabang)\b/i.test(text)) {
          result.scale = 'Besar';
        } else if (/\b(CV\.?|cabang)\b/i.test(text)) {
          result.scale = 'Menengah';
        } else {
          result.scale = 'Kecil';
        }
      }
    } catch (err: any) {
      result.error = `Crawl failed: ${err.message}`;
    }
  }

  return result;
}

// Pencarian hasil organik (misal untuk Instagram deep search)
export async function searchOrganic(query: string): Promise<{ link: string; title?: string }[]> {
  const serperKey = process.env.SERPER_API_KEY;

  // Jika user menyertakan SERPER_API_KEY
  if (serperKey && serperKey !== 'your_serper_api_key_here') {
    try {
      const resp = await axios.post(
        'https://google.serper.dev/search',
        { q: query, gl: 'id', hl: 'id' },
        { headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' }, timeout: 8000 }
      );
      if (resp.data?.organic) {
        return resp.data.organic.map((o: any) => ({ link: o.link, title: o.title }));
      }
    } catch (e: any) {
      console.warn('[Search Organic] Serper error, mencoba fallback web search...', e.message);
    }
  }

  // Fallback gratis web search untuk pencarian profil instagram
  try {
    const encoded = encodeURIComponent(query);
    const ddgResp = await axios.get(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 6000,
    });
    const $ = cheerio.load(ddgResp.data);
    const links: { link: string; title?: string }[] = [];
    $('a.result__url, a[href*="instagram.com"]').each((_, el) => {
      const href = $(el).attr('href') || $(el).text();
      if (href) {
        const match = href.match(/uddg=([^&]+)/);
        const cleanUrl = match ? decodeURIComponent(match[1]) : href;
        if (cleanUrl.includes('instagram.com')) {
          links.push({ link: cleanUrl });
        }
      }
    });
    return links;
  } catch (e) {
    return [];
  }
}
