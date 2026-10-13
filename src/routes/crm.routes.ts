import { Router, Request, Response } from 'express';
import { pool } from '../config/db.js';

const router = Router();

import crypto from 'crypto';

function buildPeriodFilter(period: string = 'all'): { where: string; params: any[] } {
  if (period === 'year_this') {
    return { where: 'YEAR(created_at) = YEAR(CURRENT_DATE())', params: [] };
  }
  if (period === 'year_last') {
    return { where: 'YEAR(created_at) = YEAR(CURRENT_DATE()) - 1', params: [] };
  }
  const monthNum = parseInt(period, 10);
  if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
    return {
      where: 'MONTH(created_at) = ? AND YEAR(created_at) = YEAR(CURRENT_DATE())',
      params: [monthNum],
    };
  }
  return { where: '1=1', params: [] };
}

// GET /api/crm/leads - Ambil semua leads (dengan filter periode)
router.get('/leads', async (req: Request, res: Response): Promise<void> => {
  const period = (req.query.period as string) || 'all';
  const { where, params } = buildPeriodFilter(period);

  try {
    if (!pool) {
      res.json({ status: 'success', data: [] });
      return;
    }
    const [rows]: [any[], any] = await pool.query(`SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC`, params);
    res.json({ status: 'success', data: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/crm/leads - Simpan atau update lead ke database
router.post('/leads', async (req: Request, res: Response): Promise<void> => {
  const input = req.body;
  if (!input || !input.title) {
    res.status(400).json({ error: 'Data prospek tidak valid.' });
    return;
  }

  const cid = input.cid || crypto.createHash('md5').update(`${input.title}-${input.address || ''}`).digest('hex');

  try {
    if (!pool) {
      res.status(500).json({ error: 'Database belum terhubung.' });
      return;
    }

    const query = `
      INSERT INTO leads (cid, title, address, phone, website, ig_url, industry, score, skala_bisnis, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tersimpan')
      ON DUPLICATE KEY UPDATE
        title=VALUES(title), address=VALUES(address), phone=VALUES(phone),
        website=VALUES(website), ig_url=VALUES(ig_url), skala_bisnis=VALUES(skala_bisnis),
        industry=VALUES(industry), score=VALUES(score);
    `;

    await pool.query(query, [
      cid,
      input.title || '',
      input.address || '',
      input.phone || '',
      input.website || '',
      input.ig_url || '',
      input.industry || 'UMKM',
      input.score || 50,
      input.skala_bisnis || 'Kecil',
    ]);

    res.json({ status: 'success', cid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/crm/update-status - Update status tahapan sales
router.post('/update-status', async (req: Request, res: Response): Promise<void> => {
  const { cid, status } = req.body;
  if (!cid || !status) {
    res.status(400).json({ error: 'Parameter cid dan status wajib disertakan.' });
    return;
  }

  try {
    if (!pool) {
      res.status(500).json({ error: 'Database belum terhubung.' });
      return;
    }
    await pool.query('UPDATE leads SET status = ? WHERE cid = ?', [status, cid]);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/crm/update-jadwal - Update jadwal tindakan/follow-up
router.post('/update-jadwal', async (req: Request, res: Response): Promise<void> => {
  const { cid, jadwal } = req.body;
  if (!cid || !jadwal) {
    res.status(400).json({ error: 'Parameter cid dan jadwal wajib disertakan.' });
    return;
  }

  try {
    if (!pool) {
      res.status(500).json({ error: 'Database belum terhubung.' });
      return;
    }
    await pool.query('UPDATE leads SET jadwal_action = ? WHERE cid = ?', [jadwal, cid]);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/crm/dashboard-stats - Metrik statistik analitik
router.get('/dashboard-stats', async (req: Request, res: Response): Promise<void> => {
  const period = (req.query.period as string) || 'all';

  const { where, params } = buildPeriodFilter(period);

  try {
    if (!pool) {
      res.json({
        status: 'success',
        data: {
          total: 0,
          follow_up: 0,
          demo: 0,
          closing: 0,
          industry: {},
          priority: { tinggi: 0, menengah: 0, rendah: 0 },
          jadwal_hari_ini: [],
        },
      });
      return;
    }

    // 1. Total Leads
    const [totalRows]: [any[], any] = await pool.query(`SELECT COUNT(*) as total FROM leads WHERE ${where}`, params);
    const total = totalRows[0]?.total || 0;

    // 2. Status counts
    const [statusRows]: [any[], any] = await pool.query(
      `SELECT status, COUNT(*) as count FROM leads WHERE ${where} GROUP BY status`,
      params
    );
    const statusMap: Record<string, number> = {};
    for (const r of statusRows) {
      statusMap[r.status] = r.count;
    }

    const followUp = statusMap['follow_up'] || 0;
    const demo = statusMap['demo'] || 0;
    const closing = (statusMap['closing'] || 0) + (statusMap['selesai'] || 0) + (statusMap['antrian'] || 0);

    // 3. Industry counts
    const [indRows]: [any[], any] = await pool.query(
      `SELECT industry, COUNT(*) as count FROM leads WHERE ${where} GROUP BY industry`,
      params
    );
    const industryCounts: Record<string, number> = {};
    for (const r of indRows) {
      industryCounts[r.industry] = r.count;
    }

    // 4. Priority counts
    const [priorityRows]: [any[], any] = await pool.query(
      `SELECT
        SUM(CASE WHEN score >= 70 THEN 1 ELSE 0 END) as tinggi,
        SUM(CASE WHEN score >= 50 AND score < 70 THEN 1 ELSE 0 END) as menengah,
        SUM(CASE WHEN score < 50 THEN 1 ELSE 0 END) as rendah
      FROM leads WHERE ${where}`,
      params
    );
    const pRow = priorityRows[0] || {};

    // 5. Jadwal Hari Ini
    const [jadwalRows]: [any[], any] = await pool.query(
      `SELECT title, jadwal_action, status, phone FROM leads WHERE jadwal_action LIKE CONCAT(CURRENT_DATE(), '%') ORDER BY jadwal_action ASC`
    );

    res.json({
      status: 'success',
      data: {
        total,
        follow_up: followUp,
        demo,
        closing,
        industry: industryCounts,
        priority: {
          tinggi: parseInt(pRow.tinggi || '0', 10),
          menengah: parseInt(pRow.menengah || '0', 10),
          rendah: parseInt(pRow.rendah || '0', 10),
        },
        jadwal_hari_ini: jadwalRows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
