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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
} catch (PDOException $e) {
    echo json_encode(['error' => 'Database connection failed. Pastikan MySQL XAMPP Anda berjalan. Detail: ' . $e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? '';

if ($action === 'get') {
    $stmt = $pdo->query("SELECT * FROM leads ORDER BY created_at DESC");
    $leads = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['status' => 'success', 'data' => $leads]);
} elseif ($action === 'save') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        echo json_encode(['error' => 'Invalid data']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("INSERT INTO leads (cid, title, address, phone, website, ig_url, industry, score) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
                               ON DUPLICATE KEY UPDATE 
                               title=VALUES(title), address=VALUES(address), phone=VALUES(phone), website=VALUES(website), ig_url=VALUES(ig_url)");
        
        $cid = isset($input['cid']) && !empty($input['cid']) ? $input['cid'] : md5($input['title'] . $input['address']);
        
        $stmt->execute([
            $cid,
            $input['title'] ?? '',
            $input['address'] ?? '',
            $input['phone'] ?? '',
            $input['website'] ?? '',
            $input['ig_url'] ?? '',
            $input['industry'] ?? 'UMKM',
            $input['score'] ?? rand(2, 5)
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
} elseif ($action === 'dashboard_stats') {
    try {
        // Total Leads
        $stmtTotal = $pdo->query("SELECT COUNT(*) as total FROM leads");
        $total = $stmtTotal->fetchColumn();

        // Status counts
        $stmtStatus = $pdo->query("SELECT status, COUNT(*) as count FROM leads GROUP BY status");
        $statusCounts = $stmtStatus->fetchAll(PDO::FETCH_KEY_PAIR);
        
        $followUp = $statusCounts['follow_up'] ?? 0;
        $demo = $statusCounts['demo'] ?? 0;
        $closing = $statusCounts['closing'] ?? 0;

        // Industry counts
        $stmtIndustry = $pdo->query("SELECT industry, COUNT(*) as count FROM leads GROUP BY industry");
        $industryCounts = $stmtIndustry->fetchAll(PDO::FETCH_KEY_PAIR);

        // Priority counts based on score
        // High (>= 70), Mid (50-69), Low (< 50)
        $stmtPriority = $pdo->query("
            SELECT 
                SUM(CASE WHEN score >= 70 THEN 1 ELSE 0 END) as tinggi,
                SUM(CASE WHEN score >= 50 AND score < 70 THEN 1 ELSE 0 END) as menengah,
                SUM(CASE WHEN score < 50 THEN 1 ELSE 0 END) as rendah
            FROM leads
        ");
        $priorityCounts = $stmtPriority->fetch(PDO::FETCH_ASSOC);

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
                ]
            ]
        ]);
    } catch (PDOException $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
} else {
    echo json_encode(['error' => 'Invalid action']);
}
?>
