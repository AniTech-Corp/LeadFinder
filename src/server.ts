import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initDatabase } from './config/db.js';

import authRoutes from './routes/auth.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import crmRoutes from './routes/crm.routes.js';
import docsRoutes from './routes/docs.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Files
app.use('/assets', express.static(path.join(rootDir, 'assets')));
app.use('/views', express.static(path.join(rootDir, 'views')));
app.use('/downloads', express.static(path.join(rootDir, 'downloads')));

// API Routes (Clean REST Endpoints)
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/docs', docsRoutes);

// --- BACKWARD COMPATIBILITY ENDPOINTS (Agar view & script lama tetap bekerja 100%) ---
// 1. backend/api.php
app.post('/backend/api.php', async (req: Request, res: Response) => {
  const { type, q } = req.body;
  if (type === 'search') {
    // Deep hunt Instagram query
    const { searchOrganic } = await import('./services/deephunt.service.js');
    const organic = await searchOrganic(q);
    res.json({ organic });
  } else {
    const { scrapeGooglePlacesViaApify } = await import('./services/apify.service.js');
    try {
      const places = await scrapeGooglePlacesViaApify(q, 'UMKM', 20);
      res.json({ places });
    } catch (e: any) {
      res.status(500).json({ error: e.message, places: [] });
    }
  }
});

// 2. backend/crm_api.php
app.all('/backend/crm_api.php', (req: Request, res: Response, next) => {
  const action = req.query.action as string;
  if (action === 'get') {
    req.url = `/leads?period=${req.query.period || 'all'}`;
    crmRoutes(req, res, next);
  } else if (action === 'save') {
    req.url = '/leads';
    crmRoutes(req, res, next);
  } else if (action === 'update_status') {
    req.url = '/update-status';
    crmRoutes(req, res, next);
  } else if (action === 'update_jadwal') {
    req.url = '/update-jadwal';
    crmRoutes(req, res, next);
  } else if (action === 'dashboard_stats') {
    req.url = `/dashboard-stats?period=${req.query.period || 'all'}`;
    crmRoutes(req, res, next);
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// 3. backend/auth.php
app.all('/backend/auth.php', (req: Request, res: Response, next) => {
  const action = req.query.action as string;
  if (action === 'login') {
    req.url = '/login';
    authRoutes(req, res, next);
  } else if (action === 'logout') {
    req.url = '/logout';
    authRoutes(req, res, next);
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// 4. backend/generate_pdf.php
app.post('/backend/generate_pdf.php', (req: Request, res: Response, next) => {
  req.url = '/generate-pdf';
  docsRoutes(req, res, next);
});

// 5. backend/ai_draft.php
app.all('/backend/ai_draft.php', async (req: Request, res: Response) => {
  const { nama, missing } = req.body || {};
  try {
    const { generateWhatsAppPitch } = await import('./services/ai.service.js');
    const draft = await generateWhatsAppPitch(nama || 'Pemilik Bisnis', missing || []);
    res.json({ status: 'success', draft });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 6. backend/deephunt.php
app.all('/backend/deephunt.php', async (req: Request, res: Response) => {
  const { website, phone } = req.body || {};
  try {
    const { runDeepHunt } = await import('./services/deephunt.service.js');
    const result = await runDeepHunt(website, phone);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// HTML Pages
app.get('/login', (_req: Request, res: Response) => {
  res.sendFile(path.join(rootDir, 'login.html'));
});

app.get('/login.html', (_req: Request, res: Response) => {
  res.sendFile(path.join(rootDir, 'login.html'));
});

app.get('/login.php', (_req: Request, res: Response) => {
  res.redirect('/login.html');
});

app.get('/index.php', (_req: Request, res: Response) => {
  res.redirect('/');
});

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
async function startServer() {
  await initDatabase();
  const server = app.listen(PORT, () => {
    console.log(`🚀 [LeadFinder Server] Berjalan di http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`⚠️ Port ${PORT} sedang digunakan oleh proses lain.`);
    } else {
      console.error('Server error:', err);
    }
  });

  const shutdown = () => {
    console.log('\nMenutup koneksi server secara aman...');
    server.close(() => {
      console.log('Server dihentikan.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();
