import axios from 'axios';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';

dotenv.config();

/**
 * Ambil template fallback dari tabel app_settings (section=branding).
 * Bila DB tak tersedia, kembalikan null agar pemanggil memakai template bawaan.
 */
async function getFallbackTemplate(): Promise<string | null> {
  try {
    if (!pool) return null;
    const [rows]: [any[], any] = await pool.query(
      "SELECT data FROM app_settings WHERE section = 'branding'"
    );
    if (rows[0]?.data) {
      const branding = JSON.parse(rows[0].data);
      if (branding.ai_fallback_template) return String(branding.ai_fallback_template);
    }
  } catch {
    /* abaikan, pakai default */
  }
  return null;
}

export async function generateWhatsAppPitch(namaBisnis: string, missingAspects: string[] = []): Promise<string> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.apmix.ai/v1');
  const model = process.env.AI_MODEL || 'claude-sonnet-4-6-free';

  const masalah = missingAspects.length === 0 ? 'aspek kehadiran digital' : missingAspects.join(' dan ');
  const solusi = missingAspects.includes('website') ? 'jasa pembuatan website profesional' : 'layanan digital marketing & optimasi';

  // Fallback copywriting default (dipakai bila template dari DB tidak tersedia)
  const defaultFallback = `Halo, perkenalkan saya dari tim digital agency Anitech.\n\nSaya menemukan profil *${namaBisnis}* di Google Maps dan melihat potensinya sangat luar biasa!\n\nNamun saya perhatikan saat ini *${namaBisnis}* belum memaksimalkan *${masalah}*. Di era sekarang, memiliki saluran digital resmi sangat krusial untuk menarik pelanggan baru di sekitar lokasi usaha.\n\nKami memiliki solusi _${solusi}_ yang dapat membantu meningkatkan kunjungan dan omzet hingga 3x lipat. Apakah Bapak/Ibu berkenan jika saya kirimkan portofolio singkat kami?`;

  const template = await getFallbackTemplate();
  const fallback = template
    ? template
        .replace(/\{nama\}/g, namaBisnis)
        .replace(/\{masalah\}/g, masalah)
        .replace(/\{solusi\}/g, solusi)
    : defaultFallback;

  if (!apiKey || apiKey.startsWith('your_')) {
    return fallback;
  }

  try {
    const prompt = `Buatkan satu paragraf pesan sapaan WhatsApp (sales pitch) yang santai, persuasif, namun profesional untuk menawarkan ${solusi} kepada bisnis bernama '${namaBisnis}'. Sebutkan secara halus bahwa bisnis mereka belum memaksimalkan ${masalah}. Jangan gunakan salam kaku seperti 'Yth.', gunakan sapaan ramah 'Halo, perkenalkan saya dari tim digital agency Anitech...'. Maksimal 3-4 kalimat.`;

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const response = await axios.post(
      endpoint,
      {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content.trim();
    }
    return fallback;
  } catch (error: any) {
    console.warn(`[AI Service] Permintaan ke ${baseUrl} gagal:`, error.message);
    return fallback;
  }
}

export interface SocialMediaDetectionResult {
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  whatsapp: string | null;
  maps: string | null;
  website: string | null;
  ai_summary: string;
}

export async function detectBusinessSocialMedia(business: {
  title: string;
  address?: string;
  phone?: string;
  website?: string | null;
  category?: string;
  mapsUrl?: string;
}): Promise<SocialMediaDetectionResult> {
  const cleanTitle = (business.title || '').trim();
  const cleanAddress = (business.address || '').trim();

  const result: SocialMediaDetectionResult = {
    instagram: null,
    tiktok: null,
    facebook: null,
    whatsapp: null,
    maps:
      business.mapsUrl && business.mapsUrl !== '#'
        ? business.mapsUrl
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanTitle + ' ' + cleanAddress)}`,
    website: business.website || null,
    ai_summary: '',
  };

  // 1. WhatsApp dari Nomor HP Indonesia
  if (business.phone) {
    const digits = business.phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('628') || digits.startsWith('08')) {
      const waNumber = digits.startsWith('08') ? '62' + digits.slice(1) : digits;
      result.whatsapp = `https://wa.me/${waNumber}`;
    }
  }

  // 2. Analisis Link Website / Bio Link (Linktree, Desty, Instagram, TikTok, Facebook)
  if (business.website) {
    const webLower = business.website.toLowerCase();
    if (webLower.includes('instagram.com/')) {
      result.instagram = business.website;
      result.website = null;
    } else if (webLower.includes('tiktok.com/')) {
      result.tiktok = business.website;
      result.website = null;
    } else if (webLower.includes('facebook.com/')) {
      result.facebook = business.website;
      result.website = null;
    } else if (webLower.includes('wa.me/') || webLower.includes('api.whatsapp.com/')) {
      result.whatsapp = business.website;
      result.website = null;
    } else if (
      webLower.includes('linktr.ee') ||
      webLower.includes('desty.page') ||
      webLower.includes('bio.link') ||
      webLower.includes('biolinky.co')
    ) {
      // Crawl bio link page untuk mengekstrak link sosmed
      try {
        let bioUrl = business.website.trim();
        if (!bioUrl.startsWith('http://') && !bioUrl.startsWith('https://')) {
          bioUrl = 'https://' + bioUrl;
        }
        const resp = await axios.get(bioUrl, {
          timeout: 4000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (resp.data && typeof resp.data === 'string') {
          const cheerio = await import('cheerio');
          const $ = cheerio.load(resp.data);
          $('a[href]').each((_, el) => {
            const h = $(el).attr('href') || '';
            if (h.includes('instagram.com') && !result.instagram) result.instagram = h;
            if (h.includes('tiktok.com') && !result.tiktok) result.tiktok = h;
            if (h.includes('facebook.com') && !result.facebook) result.facebook = h;
            if ((h.includes('wa.me') || h.includes('whatsapp.com')) && !result.whatsapp) result.whatsapp = h;
          });
        }
      } catch {
        /* abaikan crawl error */
      }
    }
  }

  // 3. AI Social Media Detective (APMix AI / Claude Sonnet)
  const apiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.apmix.ai/v1');
  const model = process.env.AI_MODEL || 'claude-sonnet-4-6-free';

  if (apiKey && !apiKey.startsWith('your_')) {
    try {
      const prompt = `Anda adalah AI Intelligence Sosial Media UMKM Indonesia. Analisis data bisnis ini:
Nama Usaha: "${cleanTitle}"
Alamat/Area: "${cleanAddress}"
Kategori: "${business.category || 'UMKM'}"
Telepon: "${business.phone || '-'}"
Website/Link: "${business.website || '-'}"

Tugas:
1. Temukan atau simpulkan kemungkinan profil media sosial bisnis ini di Indonesia (Instagram handle/link, TikTok handle/link, Facebook link).
2. Jika ada nomor HP, pastikan WhatsApp link terisi.
3. Berikan 1 kalimat kesimpulan 'ai_summary' tentang kehadiran online bisnis ini dan peluang penawaran website.

Kembalikan HANYA format JSON valid tanpa backticks markdown:
{
  "instagram": "link instagram atau null",
  "tiktok": "link tiktok atau null",
  "facebook": "link facebook atau null",
  "whatsapp": "${result.whatsapp || 'null'}",
  "maps": "${result.maps}",
  "ai_summary": "1 kalimat analisa bisnis..."
}`;

      const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const aiResp = await axios.post(
        endpoint,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const raw = aiResp.data?.choices?.[0]?.message?.content;
      if (raw && typeof raw === 'string') {
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.instagram && !result.instagram) result.instagram = parsed.instagram;
          if (parsed.tiktok && !result.tiktok) result.tiktok = parsed.tiktok;
          if (parsed.facebook && !result.facebook) result.facebook = parsed.facebook;
          if (parsed.whatsapp && !result.whatsapp) result.whatsapp = parsed.whatsapp;
          if (parsed.ai_summary) result.ai_summary = parsed.ai_summary;
        }
      }
    } catch (err: any) {
      console.warn('[AI Social Detective] Error querying AI:', err.message);
    }
  }

  // 4. Default Fallback & Sanitization - Selalu arahkan langsung ke profil akun
  if (!result.ai_summary) {
    result.ai_summary = `Prospek aktif di Google Maps (${business.category || 'UMKM'}), belum memiliki website profil resmi.`;
  }

  // Handle bersih berbasis nama bisnis (misal: "kopi.kenangan.juanda")
  const cleanHandle = cleanTitle
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    .toLowerCase();

  const simpleHandle = cleanTitle
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  const targetHandle = cleanHandle || simpleHandle;

  // Instagram: pastikan link bersih langsung ke profil (@username)
  if (!result.instagram) {
    result.instagram = targetHandle ? `https://www.instagram.com/${targetHandle}/` : null;
  } else {
    const igMatch = result.instagram.match(/instagram\.com\/([A-Za-z0-9_.]+)/);
    if (igMatch && igMatch[1] && !['explore', 'p', 'reel', 'stories', 'tv', 'tags', 'dir'].includes(igMatch[1].toLowerCase())) {
      result.instagram = `https://www.instagram.com/${igMatch[1]}/`;
    }
  }

  // TikTok: pastikan langsung ke akun profil (@username)
  if (!result.tiktok) {
    result.tiktok = targetHandle ? `https://www.tiktok.com/@${targetHandle}` : null;
  } else {
    const ttMatch = result.tiktok.match(/tiktok\.com\/@?([A-Za-z0-9_.]+)/);
    if (ttMatch && ttMatch[1] && !['search', 'tag', 'music', 'live'].includes(ttMatch[1].toLowerCase())) {
      result.tiktok = `https://www.tiktok.com/@${ttMatch[1].replace(/^@/, '')}`;
    }
  }

  // Facebook: pastikan langsung ke halaman/profil bisnis
  if (!result.facebook) {
    result.facebook = targetHandle ? `https://www.facebook.com/${targetHandle}` : null;
  } else {
    const fbMatch = result.facebook.match(/facebook\.com\/([A-Za-z0-9_.-]+)/);
    if (fbMatch && fbMatch[1] && !['search', 'share', 'sharer', 'login'].includes(fbMatch[1].toLowerCase())) {
      result.facebook = `https://www.facebook.com/${fbMatch[1]}`;
    }
  }

  return result;
}
