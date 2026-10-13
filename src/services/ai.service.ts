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
