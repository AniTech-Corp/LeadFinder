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
    let website = item.website || item.websiteUrl || null;

    // Bersihkan jika website malah link google maps
    if (website && (website.includes('google.com/maps') || website.includes('goo.gl'))) {
      website = null;
    }

    const rating = typeof item.totalScore === 'number' ? item.totalScore : (parseFloat(item.rating) || 0);
    const reviewsCount = typeof item.reviewsCount === 'number' ? item.reviewsCount : (parseInt(item.reviewsDistribution?.total || '0', 10) || 0);
    
    // Cid unik
    const cid = item.cid || item.placeId || Buffer.from(`${title}-${address}`).toString('hex').slice(0, 20);
    const mapsUrl = item.url || (item.cid ? `https://www.google.com/maps?cid=${item.cid}` : '#');

    // Instagram jika dideteksi langsung oleh Apify
    let igUrl = 'Tidak Ditemukan';
    if (item.instagram) {
      igUrl = item.instagram.startsWith('http') ? item.instagram : `https://instagram.com/${item.instagram}`;
    }

    // Hitung Skor & Prioritas Awal
    let score = 40;
    if (phone) score += 20;
    if (rating >= 4.0) score += 20;
    if (reviewsCount >= 30) score += 10;
    if (igUrl !== 'Tidak Ditemukan') score += 10;
    if (!website) score += 10; // Prioritas tinggi jika belum ada website

    const finalScore = Math.min(score, 100);
    let priority: 'Tinggi' | 'Menengah' | 'Rendah' = 'Rendah';
    if (finalScore >= 70) priority = 'Tinggi';
    else if (finalScore >= 50) priority = 'Menengah';

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
      igUrl,
      score: finalScore,
      priority,
      skala_bisnis: 'Kecil',
    });
  }

  console.log(`[Apify] Berhasil mengekstrak ${results.length} data bisnis.`);
  return results;
}
