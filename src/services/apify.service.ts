import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config();

export interface ScrapedPlace {
  cid: string;
  title: string;
  address: string;
  phoneNumber: string;
  website: string | null;
  rating: number;
  user_ratings_total: number;
  searchCategory: string;
  mapsUrl: string;
  igUrl?: string;
  sosmed_data?: any;
  score?: number;
  priority?: 'Tinggi' | 'Menengah' | 'Rendah';
  skala_bisnis?: 'Kecil' | 'Menengah' | 'Besar';
}

export async function scrapeGooglePlacesViaApify(
  searchQuery: string,
  category: string = 'UMKM',
  maxPlaces: number = 15
): Promise<ScrapedPlace[]> {
  if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) {
    return [];
  }

  const cleanQuery = searchQuery.trim();
  const token = process.env.APIFY_TOKEN;

  if (!token || token === 'your_apify_api_token_here') {
    throw new Error('APIFY_TOKEN belum disetting di file .env. Silakan masukkan Apify API token Anda.');
  }

  const client = new ApifyClient({ token });

  // Ekstrak kota jika ada pattern "di [Kota]"
  let locationQuery = 'Indonesia';
  const diMatch = cleanQuery.match(/di\s+([^,]+)/i);
  if (diMatch && diMatch[1]) {
    locationQuery = `${diMatch[1].trim()}, Indonesia`;
  } else {
    locationQuery = `${cleanQuery}, Indonesia`;
  }

  console.log(`[Apify] Menjalankan Google Maps Scraper: "${cleanQuery}" | Lokasi: "${locationQuery}" (Maks: ${maxPlaces})...`);

  let run: any;
  try {
    // Panggil Actor compass/crawler-google-places dengan input yang valid
    run = await client.actor('compass/crawler-google-places').call(
      {
        searchStringsArray: [cleanQuery],
        locationQuery: locationQuery,
        maxCrawledPlacesPerSearch: maxPlaces,
        language: 'id',
      },
      {
        timeout: 120, // Maksimal 2 menit
      }
    );
  } catch (err: any) {
    if (err.message?.includes('Rate limit') || err.message?.includes('429')) {
      throw new Error('Batas panggilan Apify (rate limit) tercapai. Silakan coba sesaat lagi.');
    }
    if (err.message?.includes('credit') || err.message?.includes('quota') || err.message?.includes('exceeded')) {
      throw new Error('Kuota kredit Apify bulanan habis. Silakan periksa saldo di console.apify.com.');
    }
    throw new Error(`Apify error: ${err.message}`);
  }

  console.log(`[Apify] Run selesai (${run.id}), mengambil dataset...`);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const results: ScrapedPlace[] = [];

  for (const item of items as any[]) {
    const title = item.title || item.name || '';
    if (!title) continue;

    const address = item.address || item.formattedAddress || item.street || '';
    let phone = item.phone || item.phoneNumber || item.phoneUnformatted || '';
    let rawWebsite = item.website || item.websiteUrl || null;

    let website: string | null = rawWebsite;
    let igUrl: string | null = null;
    let tiktokUrl: string | null = null;
    let facebookUrl: string | null = null;
    let waUrl: string | null = null;

    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('628') || cleanPhone.startsWith('08')) {
        const waNum = cleanPhone.startsWith('08') ? '62' + cleanPhone.slice(1) : cleanPhone;
        waUrl = `https://wa.me/${waNum}`;
      }
    }

    if (website) {
      const webLower = website.toLowerCase();
      if (webLower.includes('google.com/maps') || webLower.includes('goo.gl')) {
        website = null;
      } else if (webLower.includes('instagram.com/')) {
        const igMatch = website.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
        if (igMatch && igMatch[1] && !['explore', 'p', 'reel', 'stories', 'tv', 'tags', 'dir'].includes(igMatch[1].toLowerCase())) {
          igUrl = `https://www.instagram.com/${igMatch[1]}/`;
        } else {
          igUrl = website;
        }
        website = null; // Bukan website perusahaan, ini akun Instagram!
      } else if (webLower.includes('tiktok.com/')) {
        const ttMatch = website.match(/tiktok\.com\/@?([A-Za-z0-9_.]+)/i);
        if (ttMatch && ttMatch[1] && !['search', 'tag', 'music', 'live'].includes(ttMatch[1].toLowerCase())) {
          tiktokUrl = `https://www.tiktok.com/@${ttMatch[1].replace(/^@/, '')}`;
        } else {
          tiktokUrl = website;
        }
        website = null; // Bukan website perusahaan, ini akun TikTok!
      } else if (webLower.includes('facebook.com/') || webLower.includes('fb.com/')) {
        const fbMatch = website.match(/(?:facebook\.com|fb\.com)\/([A-Za-z0-9_.-]+)/i);
        if (fbMatch && fbMatch[1] && !['search', 'share', 'sharer', 'login'].includes(fbMatch[1].toLowerCase())) {
          facebookUrl = `https://www.facebook.com/${fbMatch[1]}`;
        } else {
          facebookUrl = website;
        }
        website = null; // Akun Facebook!
      } else if (webLower.includes('wa.me/') || webLower.includes('api.whatsapp.com/')) {
        waUrl = website;
        website = null; // Link WhatsApp!
      } else if (
        webLower.includes('linktr.ee') ||
        webLower.includes('desty.page') ||
        webLower.includes('bio.link') ||
        webLower.includes('biolinky.co')
      ) {
        website = null; // Bio link bukan website mandiri resmi
      }
    }

    // Jika item Apify sendiri mendeteksi instagram
    if (item.instagram && !igUrl) {
      igUrl = item.instagram.startsWith('http') ? item.instagram : `https://www.instagram.com/${item.instagram}/`;
    }

    const rating = typeof item.totalScore === 'number' ? item.totalScore : (parseFloat(item.rating) || 0);
    const reviewsCount = typeof item.reviewsCount === 'number' ? item.reviewsCount : (parseInt(item.reviewsDistribution?.total || '0', 10) || 0);
    
    // Cid unik
    const cid = item.cid || item.placeId || Buffer.from(`${title}-${address}`).toString('hex').slice(0, 20);
    const mapsUrl = item.url || (item.cid ? `https://www.google.com/maps?cid=${item.cid}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title + ' ' + address)}`);

    // Hitung Skor & Prioritas Awal
    let score = 35;
    if (phone) score += 20;
    if (rating >= 4.0) score += 15;
    if (reviewsCount >= 30) score += 10;
    if (igUrl || tiktokUrl) score += 10;
    if (!website) score += 20; // Prioritas tinggi jika belum ada website resmi perusahaan!

    const finalScore = Math.min(score, 100);
    let priority: 'Tinggi' | 'Menengah' | 'Rendah' = 'Rendah';
    if (finalScore >= 70) priority = 'Tinggi';
    else if (finalScore >= 50) priority = 'Menengah';

    const initialSosmed = {
      instagram: igUrl,
      tiktok: tiktokUrl,
      facebook: facebookUrl,
      whatsapp: waUrl,
      maps: mapsUrl,
      website: website,
      ai_summary: igUrl
        ? `Memiliki akun Instagram resmi (${igUrl}) di profil Google Maps, belum memiliki website perusahaan.`
        : (website ? `Memiliki website resmi (${website}).` : `Belum memiliki website resmi maupun akun sosmed terdata di Google Maps.`)
    };

    results.push({
      cid,
      title,
      address,
      phoneNumber: phone,
      website,
      rating,
      user_ratings_total: reviewsCount,
      searchCategory: item.categoryName || category,
      mapsUrl,
      igUrl: igUrl || 'Tidak Ditemukan',
      sosmed_data: initialSosmed,
      score: finalScore,
      priority,
      skala_bisnis: 'Kecil',
    });
  }

  console.log(`[Apify] Berhasil mengekstrak ${results.length} data bisnis.`);
  return results;
}
