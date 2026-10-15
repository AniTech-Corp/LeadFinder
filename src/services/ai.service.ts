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

function formatInstagramUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
  if (m && m[1] && !['explore', 'p', 'reel', 'stories', 'tv', 'tags', 'dir', 'accounts', 'about'].includes(m[1].toLowerCase())) {
    return `https://www.instagram.com/${m[1]}/`;
  }
  return null;
}

function formatTikTokUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/tiktok\.com\/@?([A-Za-z0-9_.]+)/i);
  if (m && m[1] && !['search', 'tag', 'music', 'live', 'discover'].includes(m[1].toLowerCase())) {
    return `https://www.tiktok.com/@${m[1].replace(/^@/, '')}`;
  }
  return null;
}

function formatFacebookUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('facebook.com/profile.php')) {
    const idMatch = url.match(/id=([0-9]+)/);
    if (idMatch) return `https://www.facebook.com/profile.php?id=${idMatch[1]}`;
  }
  const m = url.match(/(?:facebook\.com|fb\.com)\/([A-Za-z0-9_.-]+)/i);
  if (m && m[1] && !['search', 'share', 'sharer', 'login', 'groups', 'events', 'watch', 'pages', 'hashtag', 'profile.php'].includes(m[1].toLowerCase())) {
    return `https://www.facebook.com/${m[1]}`;
  }
  return null;
}

async function crawlPageForSocials(url: string): Promise<{
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  whatsapp: string | null;
}> {
  const found: {
    instagram: string | null;
    tiktok: string | null;
    facebook: string | null;
    whatsapp: string | null;
  } = { instagram: null, tiktok: null, facebook: null, whatsapp: null };
  try {
    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    const resp = await axios.get(target, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 4,
    });
    if (resp.data && typeof resp.data === 'string') {
      const cheerio = await import('cheerio');
      const $ = cheerio.load(resp.data);
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (!found.instagram && href.includes('instagram.com/')) {
          found.instagram = formatInstagramUrl(href);
        }
        if (!found.tiktok && href.includes('tiktok.com/')) {
          found.tiktok = formatTikTokUrl(href);
        }
        if (!found.facebook && (href.includes('facebook.com/') || href.includes('fb.com/'))) {
          found.facebook = formatFacebookUrl(href);
        }
        if (!found.whatsapp && (href.includes('wa.me/') || href.includes('api.whatsapp.com/'))) {
          found.whatsapp = href;
        }
      });
    }
  } catch {
    /* abaikan crawl error */
  }
  return found;
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

  // 2. Analisis Link Website / Bio Link (Instagram, TikTok, Facebook, Linktree, dll)
  if (business.website) {
    const webLower = business.website.toLowerCase();
    if (webLower.includes('instagram.com/')) {
      result.instagram = formatInstagramUrl(business.website);
      result.website = null;
    } else if (webLower.includes('tiktok.com/')) {
      result.tiktok = formatTikTokUrl(business.website);
      result.website = null;
    } else if (webLower.includes('facebook.com/') || webLower.includes('fb.com/')) {
      result.facebook = formatFacebookUrl(business.website);
      result.website = null;
    } else if (webLower.includes('wa.me/') || webLower.includes('api.whatsapp.com/')) {
      result.whatsapp = business.website;
      result.website = null;
    } else if (
      webLower.includes('linktr.ee') ||
      webLower.includes('desty.page') ||
      webLower.includes('bio.link') ||
      webLower.includes('biolinky.co') ||
      webLower.includes('campsite.bio')
    ) {
      // Bio link -> crawl untuk ekstrak sosmed
      const bioSocials = await crawlPageForSocials(business.website);
      if (bioSocials.instagram) result.instagram = bioSocials.instagram;
      if (bioSocials.tiktok) result.tiktok = bioSocials.tiktok;
      if (bioSocials.facebook) result.facebook = bioSocials.facebook;
      if (bioSocials.whatsapp && !result.whatsapp) result.whatsapp = bioSocials.whatsapp;
      result.website = null; // Bio link bukan website mandiri resmi
    } else {
      // Website mandiri resmi -> crawl homepage untuk mengekstrak sosmed resmi perusahaan
      const webSocials = await crawlPageForSocials(business.website);
      if (webSocials.instagram) result.instagram = webSocials.instagram;
      if (webSocials.tiktok) result.tiktok = webSocials.tiktok;
      if (webSocials.facebook) result.facebook = webSocials.facebook;
      if (webSocials.whatsapp && !result.whatsapp) result.whatsapp = webSocials.whatsapp;
    }
  }

  // 3. AI Social Media Intelligence (APMix AI / Claude Sonnet) jika belum lengkap
  const apiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.apmix.ai/v1');
  const model = process.env.AI_MODEL || 'claude-sonnet-4-6-free';

  if (apiKey && !apiKey.startsWith('your_') && (!result.instagram || !result.tiktok || !result.facebook)) {
    try {
      const prompt = `Anda adalah AI Intelligence Sosial Media UMKM Indonesia. Analisis data bisnis ini:
Nama Usaha: "${cleanTitle}"
Alamat/Area: "${cleanAddress}"
Kategori: "${business.category || 'UMKM'}"
Telepon: "${business.phone || '-'}"
Website: "${result.website || '-'}"
Instagram Terdeteksi: "${result.instagram || '-'}"

Tugas:
1. Jika Anda mengetahui akun resmi Instagram, TikTok, atau Facebook bisnis ini di Indonesia, berikan URL profil langsungnya.
2. PENTING: DILARANG MENEBAK ATAU MENGARANG AKUN PALSU. Jika tidak yakin atau tidak ditemukan akun resmi, kembalikan null!
3. Berikan 1 kalimat objektif 'ai_summary' mengenai status kehadiran digital bisnis ini dan peluang penawaran website.

Kembalikan HANYA format JSON valid tanpa markdown backticks:
{
  "instagram": ${result.instagram ? `"${result.instagram}"` : '"link atau null"'},
  "tiktok": ${result.tiktok ? `"${result.tiktok}"` : '"link atau null"'},
  "facebook": ${result.facebook ? `"${result.facebook}"` : '"link atau null"'},
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
          temperature: 0.1,
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
          if (parsed.instagram && parsed.instagram !== 'null' && !result.instagram) {
            result.instagram = formatInstagramUrl(parsed.instagram);
          }
          if (parsed.tiktok && parsed.tiktok !== 'null' && !result.tiktok) {
            result.tiktok = formatTikTokUrl(parsed.tiktok);
          }
          if (parsed.facebook && parsed.facebook !== 'null' && !result.facebook) {
            result.facebook = formatFacebookUrl(parsed.facebook);
          }
          if (parsed.whatsapp && parsed.whatsapp !== 'null' && !result.whatsapp) {
            result.whatsapp = parsed.whatsapp;
          }
          if (parsed.ai_summary) {
            result.ai_summary = parsed.ai_summary;
          }
        }
      }
    } catch (err: any) {
      console.warn('[AI Social Detective] Error querying AI:', err.message);
    }
  }

  // 4. Sanitasi Akhir & Ringkasan Digital Presence Objektif
  result.instagram = formatInstagramUrl(result.instagram);
  result.tiktok = formatTikTokUrl(result.tiktok);
  result.facebook = formatFacebookUrl(result.facebook);

  if (!result.ai_summary) {
    if (result.website) {
      result.ai_summary = `Memiliki website resmi (${result.website})${result.instagram ? ' dan akun Instagram terverifikasi' : ''}.`;
    } else if (result.instagram || result.tiktok || result.facebook) {
      const activeSosmed = [result.instagram ? 'Instagram' : '', result.tiktok ? 'TikTok' : '', result.facebook ? 'Facebook' : ''].filter(Boolean).join(', ');
      result.ai_summary = `Aktif di media sosial (${activeSosmed}), belum memiliki website profil resmi perusahaan (Peluang Prospek Tinggi).`;
    } else {
      result.ai_summary = `Terdaftar di Google Maps (${business.category || 'UMKM'}), belum memiliki website maupun media sosial resmi terdeteksi.`;
    }
  }

  return result;
}
