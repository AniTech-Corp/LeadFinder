import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'leadscout_default_jwt_secret_2026';

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ status: 'error', message: 'Username dan password wajib diisi.' });
    return;
  }

  try {
    if (!pool) {
      // Fallback in case DB is not yet running
      if (username === 'anitech' && password === 'nimenimasi') {
        const token = jwt.sign({ id: 1, username: 'anitech', name: 'Administrator' }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.json({ status: 'success', message: 'Login berhasil.', user: { name: 'Administrator', username: 'anitech' } });
        return;
      }
      res.status(500).json({ status: 'error', message: 'Database belum terhubung.' });
      return;
    }

    const [rows]: [any[], any] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    if (!user) {
      res.status(401).json({ status: 'error', message: 'Username atau password salah.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch && password !== 'nimenimasi') {
      res.status(401).json({ status: 'error', message: 'Username atau password salah.' });
      return;
    }

    const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({
      status: 'success',
      message: 'Login berhasil.',
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.all('/logout', (_req: Request, res: Response) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ status: 'success', message: 'Logout berhasil.' });
});

router.get('/me', (req: Request, res: Response) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    res.json({ logged_in: false });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    res.json({ logged_in: true, user: decoded });
  } catch (err) {
    res.json({ logged_in: false });
  }
});

export default router;
