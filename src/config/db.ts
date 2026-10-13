import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from './app-settings.seed.js';

dotenv.config();

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || 'leadscout';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);

export let pool: mysql.Pool;

export async function initDatabase(): Promise<boolean> {
  try {
    // 1. Initial connection to create database if not exists
    const rootConn = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      port: DB_PORT,
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();

    // 2. Pool to the specific database
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // 3. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Seed default admin if empty
    const [rows]: [any[], any] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0]?.count === 0) {
      const defaultHash = await bcrypt.hash('nimenimasi', 10);
      await pool.query(
        'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
        ['anitech', defaultHash, 'Administrator', 'admin']
      );
      console.log('✓ Default admin user seeded: username=anitech, pass=nimenimasi');
    }

    // 5. Create leads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cid VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(100),
        website TEXT,
        ig_url TEXT,
        status VARCHAR(50) DEFAULT 'baru',
        industry VARCHAR(100) DEFAULT 'UMKM',
        score INT DEFAULT 40,
        skala_bisnis ENUM('Kecil', 'Menengah', 'Besar') DEFAULT 'Kecil',
        jadwal_action VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Create tbl_katalog_layanan
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tbl_katalog_layanan (
        id_layanan INT AUTO_INCREMENT PRIMARY KEY,
        nama_paket VARCHAR(255) NOT NULL,
        deskripsi_fitur TEXT,
        estimasi_hari INT,
        harga DECIMAL(15,2) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed katalog if empty
    const [katalogRows]: [any[], any] = await pool.query('SELECT COUNT(*) as count FROM tbl_katalog_layanan');
    if (katalogRows[0]?.count === 0) {
      await pool.query(`
        INSERT INTO tbl_katalog_layanan (id_layanan, nama_paket, deskripsi_fitur, estimasi_hari, harga) VALUES
        (1, 'Web Company Profile Basic', 'Desain standar, 5 Halaman, Form Kontak, Mobile Responsive.', 7, 2500000),
        (2, 'Web Company Profile Pro', 'Desain premium, 10 Halaman, Integrasi WA, SEO Basic, Hosting 1 Tahun.', 14, 5000000),
        (3, 'Toko Online (E-Commerce)', 'Katalog produk tak terbatas, Keranjang Belanja, Integrasi Ongkir & Payment Gateway.', 30, 8500000),
        (4, 'Landing Page Sales', '1 Halaman panjang, Copywriting, Tombol CTA melayang, Kecepatan tinggi.', 5, 1500000),
        (5, 'Sistem Kasir (POS) Cloud', 'Manajemen Stok, Laporan Penjualan, Cetak Struk, Multi-Cabang.', 21, 12000000);
      `);
    }

    // 7. Create tbl_dokumen
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tbl_dokumen (
        no_dokumen VARCHAR(50) PRIMARY KEY,
        cid VARCHAR(255) NOT NULL,
        jenis ENUM('Proposal', 'Invoice') NOT NULL,
        id_layanan INT,
        total_tagihan DECIMAL(15,2) NOT NULL,
        status_bayar ENUM('Belum Bayar', 'DP', 'Lunas') DEFAULT 'Belum Bayar',
        tanggal_cetak DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cid) REFERENCES leads(cid) ON DELETE CASCADE,
        FOREIGN KEY (id_layanan) REFERENCES tbl_katalog_layanan(id_layanan) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. Tambah kolom rincian_fitur & catatan pada tbl_dokumen (aman dijalankan ulang)
    for (const alter of [
      'ADD COLUMN rincian_fitur TEXT DEFAULT NULL AFTER id_layanan',
      'ADD COLUMN catatan TEXT DEFAULT NULL AFTER rincian_fitur',
    ]) {
      try {
        await pool.query(`ALTER TABLE tbl_dokumen ${alter}`);
      } catch {
        // Kolom mungkin sudah ada, abaikan
      }
    }

    // 9. Create tbl_fitur_opsional (master list fitur tambahan)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tbl_fitur_opsional (
        id_fitur INT AUTO_INCREMENT PRIMARY KEY,
        nama_fitur VARCHAR(255) NOT NULL,
        harga DECIMAL(15,2) NOT NULL DEFAULT 0,
        kategori VARCHAR(100) DEFAULT 'Umum',
        is_aktif TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed fitur opsional if empty
    const [fiturRows]: [any[], any] = await pool.query('SELECT COUNT(*) as count FROM tbl_fitur_opsional');
    if (fiturRows[0]?.count === 0) {
      await pool.query(`
        INSERT INTO tbl_fitur_opsional (id_fitur, nama_fitur, harga, kategori) VALUES
        (1, 'Domain & Hosting 1 Tahun', 750000, 'Infrastruktur'),
        (2, 'Optimasi SEO On-Page Basic', 1000000, 'Marketing'),
        (3, 'Copywriting Konten (5 halaman)', 600000, 'Konten'),
        (4, 'Integrasi WhatsApp Business', 400000, 'Integrasi'),
        (5, 'Maintenance & Support 3 Bulan', 900000, 'Support'),
        (6, 'Galeri Foto / Video Profil', 500000, 'Konten'),
        (7, 'Logo & Identitas Visual', 1200000, 'Branding');
      `);
    }

    // 10. Create app_settings (konten dinamis: company, brands, dokumen_defaults, branding, lokasi)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        section VARCHAR(50) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed app_settings if empty
    const [settingsRows]: [any[], any] = await pool.query('SELECT COUNT(*) as count FROM app_settings');
    if (settingsRows[0]?.count === 0) {
      for (const [section, value] of Object.entries(DEFAULT_SETTINGS)) {
        await pool.query('INSERT INTO app_settings (section, data) VALUES (?, ?)', [
          section,
          JSON.stringify(value),
        ]);
      }
      console.log('✓ app_settings default seeded (company, brands, dokumen_defaults, branding, lokasi).');
    }

    // 11. Create tbl_kategori_industri (master kategori UMKM)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tbl_kategori_industri (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(100) NOT NULL UNIQUE,
        ikon VARCHAR(50) DEFAULT NULL,
        urutan INT DEFAULT 0,
        is_aktif TINYINT(1) NOT NULL DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed kategori if empty
    const [kategoriRows]: [any[], any] = await pool.query('SELECT COUNT(*) as count FROM tbl_kategori_industri');
    if (kategoriRows[0]?.count === 0) {
      for (const k of DEFAULT_CATEGORIES) {
        await pool.query('INSERT INTO tbl_kategori_industri (nama, ikon, urutan) VALUES (?, ?, ?)', [
          k.nama,
          k.ikon,
          k.urutan,
        ]);
      }
      console.log('✓ tbl_kategori_industri default seeded.');
    }

    console.log('✓ MySQL database and tables initialized successfully.');
    return true;
  } catch (error: any) {
    console.error('⚠️ Database connection warning:', error.message);
    console.error('Pastikan MariaDB/MySQL berjalan (`sudo systemctl start mariadb`).');
    return false;
  }
}
