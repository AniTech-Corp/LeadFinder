<?php
$host = '127.0.0.1';
$db   = 'leadscout';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    throw new \PDOException($e->getMessage(), (int)$e->getCode());
}

try {
    // 1. Create tbl_katalog_layanan
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tbl_katalog_layanan (
            id_layanan INT AUTO_INCREMENT PRIMARY KEY,
            nama_paket VARCHAR(255) NOT NULL,
            deskripsi_fitur TEXT,
            estimasi_hari INT,
            harga DECIMAL(15,2) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // Insert dummy data for katalog
    $pdo->exec("
        INSERT IGNORE INTO tbl_katalog_layanan (id_layanan, nama_paket, deskripsi_fitur, estimasi_hari, harga) VALUES
        (1, 'Web Company Profile Basic', 'Desain standar, 5 Halaman, Form Kontak, Mobile Responsive.', 7, 2500000),
        (2, 'Web Company Profile Pro', 'Desain premium, 10 Halaman, Integrasi WA, SEO Basic, Hosting 1 Tahun.', 14, 5000000),
        (3, 'Toko Online (E-Commerce)', 'Katalog produk tak terbatas, Keranjang Belanja, Integrasi Ongkir & Payment Gateway.', 30, 8500000),
        (4, 'Landing Page Sales', '1 Halaman panjang, Copywriting, Tombol CTA melayang, Kecepatan tinggi.', 5, 1500000),
        (5, 'Sistem Kasir (POS) Cloud', 'Manajemen Stok, Laporan Penjualan, Cetak Struk, Multi-Cabang.', 21, 12000000)
    ");

    // 2. Create tbl_dokumen
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tbl_dokumen (
            no_dokumen VARCHAR(50) PRIMARY KEY,
            cid VARCHAR(50) NOT NULL,
            jenis ENUM('Proposal', 'Invoice') NOT NULL,
            id_layanan INT,
            total_tagihan DECIMAL(15,2) NOT NULL,
            status_bayar ENUM('Belum Bayar', 'DP', 'Lunas') DEFAULT 'Belum Bayar',
            tanggal_cetak DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cid) REFERENCES leads(cid) ON DELETE CASCADE,
            FOREIGN KEY (id_layanan) REFERENCES tbl_katalog_layanan(id_layanan) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    echo "Tables created and seeded successfully.";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
