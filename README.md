# LeadFinder (LeadScout AI) 🚀
**Sistem Manajemen Prospek UMKM (Full TypeScript & Node.js Ecosystem + Apify Scraper)**

Platform otomasi **B2B Lead Generation & Sales CRM** yang dirancang untuk mencari, menganalisis kelayakan digital, mengelola pipeline prospek, membuat penawaran otomatis via AI, dan mencetak dokumen legal (Proposal & Invoice PDF).

---

## 🛠️ Tech Stack Baru (Full JavaScript & TypeScript)

- **Backend**: Node.js & TypeScript (Express.js, `tsx`, `jwt`, `pdfkit`, `mysql2`).
- **Data Scraping**: **Apify API** (`compass/crawler-google-places` Google Maps Scraper).
- **Web Crawling & Sosmed**: `cheerio` & `axios` (Deteksi WhatsApp, Instagram, FB, TikTok, X, skala bisnis).
- **AI Copywriter**: OpenRouter / OpenAI GPT-4o-mini (WhatsApp Sales Outreach Generator).
- **Database**: MySQL / MariaDB (`leadscout`).
- **Frontend**: Single Page Application (SPA), Vanilla JS, Tailwind CSS, Remix Icons, Chart.js, SheetJS.

---

## 📋 Langkah-Langkah Integrasi & Menjalankan Sistem

### 1. Dapatkan Token API Apify (Gratis $5 / Bulan)
1. Buka dan daftar akun di [Console Apify](https://console.apify.com/sign-up) (gratis, tanpa perlu kartu kredit).
2. Masuk ke menu **Settings** &rarr; [Integrations / API Tokens](https://console.apify.com/account/integrations).
3. Salin **Personal API Token** Anda.

### 2. Konfigurasi Environment (`.env`)
Salin file `.env.example` ke `.env` (jika belum ada) dan isi token Apify Anda:
```bash
cp .env.example .env
```
Buka `.env` lalu masukkan token:
```env
PORT=3000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=
DB_NAME=leadscout
DB_PORT=3306
JWT_SECRET=leadfinder_super_secret_jwt_key_2026

# Masukkan Token Apify Anda di sini:
APIFY_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# (Opsional) Masukkan OpenRouter Key untuk AI copywriting:
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Jalankan Database MySQL (Docker)
Jalankan container database khusus untuk project ini menggunakan Docker Compose:
```bash
npm run db:up
# ATAU docker compose up -d
```
Untuk menghentikan database: `npm run db:down`
Untuk melihat log database: `npm run db:logs`

> *Catatan: Sistem akan otomatis membuat database `leadscout` dan seluruh tabel yang dibutuhkan saat server pertama kali dijalankan.*

### 4. Jalankan Aplikasi
Jalankan server dalam mode development:
```bash
npm run dev
```
Atau build ke bundle produksi:
```bash
npm run build
npm start
```

### 5. Akses Aplikasi & Akun Default
- Buka browser di: [http://localhost:3000](http://localhost:3000)
- **Username Default**: `anitech`
- **Password Default**: `nimenimasi`
