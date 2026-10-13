<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$host = '127.0.0.1';
$db   = 'leadscout';
$user = 'root';
$pass = '';

try {
    // Buat Database jika belum ada
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db`");
    $pdo->exec("USE `$db`");

    // Buat tabel jika belum ada
    $pdo->exec("CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cid VARCHAR(255) UNIQUE,
        title VARCHAR(255),
        address TEXT,
        phone VARCHAR(100),
        website TEXT,
        ig_url TEXT,
        status VARCHAR(50) DEFAULT 'baru',
        industry VARCHAR(100),
        score INT DEFAULT 3,
        skala_bisnis ENUM('Kecil', 'Menengah', 'Besar') DEFAULT 'Kecil',
        jadwal_action VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    
    try {
        $pdo->exec("ALTER TABLE leads ADD COLUMN jadwal_action VARCHAR(255) DEFAULT NULL");
        $pdo->exec("ALTER TABLE leads ADD COLUMN skala_bisnis ENUM('Kecil', 'Menengah', 'Besar') DEFAULT 'Kecil' AFTER industry");
    } catch (PDOException $e) {
        // Kolom mungkin sudah ada, abaikan error
    }
} catch (PDOException $e) {
    echo json_encode(['error' => 'Database connection failed. Pastikan MySQL XAMPP Anda berjalan. Detail: ' . $e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? '';

if ($action === 'get') {
    $period = $_GET['period'] ?? 'all';
    $where = "1=1";
    $params = [];

    if ($period === 'year_this') {
        $where = "YEAR(created_at) = YEAR(CURRENT_DATE())";
    } elseif ($period === 'year_last') {
        $where = "YEAR(created_at) = YEAR(CURRENT_DATE()) - 1";
    } elseif ($period !== 'all') {
        $where = "MONTH(created_at) = ? AND YEAR(created_at) = YEAR(CURRENT_DATE())";
        $params[] = $period;
    }

    $stmt = $pdo->prepare("SELECT * FROM leads WHERE $where ORDER BY created_at DESC");
    $stmt->execute($params);
    $leads = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['status' => 'success', 'data' => $leads]);
} elseif ($action === 'save') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("INSERT INTO leads (cid, title, address, phone, website, ig_url, industry, score, skala_bisnis, status) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tersimpan') 
                               ON DUPLICATE KEY UPDATE 
                               title=VALUES(title), address=VALUES(address), phone=VALUES(phone), website=VALUES(website), ig_url=VALUES(ig_url), skala_bisnis=VALUES(skala_bisnis)");
        
        $cid = isset($input['cid']) && !empty($input['cid']) ? $input['cid'] : md5($input['title'] . $input['address']);
        
        $stmt->execute([
            $cid,
            $input['title'] ?? '',
            $input['address'] ?? '',
            $input['phone'] ?? '',
            $input['website'] ?? '',
            $input['ig_url'] ?? '',
            $input['industry'] ?? 'UMKM',
            $input['score'] ?? rand(2, 5),
            $input['skala_bisnis'] ?? 'Kecil'
        ]);
        echo json_encode(['status' => 'success', 'cid' => $cid]);
    } catch (PDOException $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
} elseif ($action === 'update_status') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['cid']) || !isset($input['status'])) {
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE leads SET status = ? WHERE cid = ?");
        $stmt->execute([$input['status'], $input['cid']]);
        echo json_encode(['status' => 'success']);
    } catch (PDOException $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
} elseif ($action === 'update_jadwal') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['cid']) || !isset($input['jadwal'])) {
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE leads SET jadwal_action = ? WHERE cid = ?");
        $stmt->execute([$input['jadwal'], $input['cid']]);
        echo json_encode(['status' => 'success']);
    } catch (PDOException $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
} elseif ($action === 'dashboard_stats') {
    try {
        $period = $_GET['period'] ?? '10';
        $where = "1=1";
        $params = [];

        if ($period === 'all') {
            $where = "1=1";
        } elseif ($period === 'year_this') {
            $where = "YEAR(created_at) = YEAR(CURRENT_DATE())";
        } elseif ($period === 'year_last') {
            $where = "YEAR(created_at) = YEAR(CURRENT_DATE()) - 1";
        } else {
            $where = "MONTH(created_at) = ? AND YEAR(created_at) = YEAR(CURRENT_DATE())";
            $params[] = $period;
        }

        // Total Leads
        $stmtTotal = $pdo->prepare("SELECT COUNT(*) as total FROM leads WHERE $where");
        $stmtTotal->execute($params);
        $total = $stmtTotal->fetchColumn();

        // Status counts
        $stmtStatus = $pdo->prepare("SELECT status, COUNT(*) as count FROM leads WHERE $where GROUP BY status");
        $stmtStatus->execute($params);
        $statusCounts = $stmtStatus->fetchAll(PDO::FETCH_KEY_PAIR);
        
        $followUp = $statusCounts['follow_up'] ?? 0;
        $demo = $statusCounts['demo'] ?? 0;
        $closing = ($statusCounts['closing'] ?? 0) + ($statusCounts['selesai'] ?? 0);

        // Industry counts
        $stmtIndustry = $pdo->prepare("SELECT industry, COUNT(*) as count FROM leads WHERE $where GROUP BY industry");
        $stmtIndustry->execute($params);
        $industryCounts = $stmtIndustry->fetchAll(PDO::FETCH_KEY_PAIR);

        // Priority counts based on score
        $stmtPriority = $pdo->prepare("
            SELECT 
                SUM(CASE WHEN score >= 70 THEN 1 ELSE 0 END) as tinggi,
                SUM(CASE WHEN score >= 50 AND score < 70 THEN 1 ELSE 0 END) as menengah,
                SUM(CASE WHEN score < 50 THEN 1 ELSE 0 END) as rendah
            FROM leads WHERE $where
        ");
        $stmtPriority->execute($params);
        $priorityCounts = $stmtPriority->fetch(PDO::FETCH_ASSOC);

        // Jadwal Hari Ini
        $stmtJadwal = $pdo->query("SELECT title, jadwal_action, status, phone FROM leads WHERE jadwal_action LIKE CONCAT(CURRENT_DATE(), '%') ORDER BY jadwal_action ASC");
        $jadwalHariIni = $stmtJadwal->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'status' => 'success',
            'data' => [
                'total' => $total,
                'follow_up' => $followUp,
                'demo' => $demo,
                'closing' => $closing,
                'industry' => $industryCounts,
                'priority' => [
                    'tinggi' => $priorityCounts['tinggi'] ?? 0,
                    'menengah' => $priorityCounts['menengah'] ?? 0,
                    'rendah' => $priorityCounts['rendah'] ?? 0
                ],
                'jadwal_hari_ini' => $jadwalHariIni
            ]
        ]);
    } catch (PDOException $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
} else {
    echo json_encode(['error' => 'Invalid action']);
}
?>
