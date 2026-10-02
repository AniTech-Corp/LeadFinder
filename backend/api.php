<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, X-API-KEY');

// Terima request JSON dari frontend
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, TRUE); // Convert JSON ke Array

if (!isset($input['q'])) {
    echo json_encode(['error' => 'Kata kunci (q) tidak diberikan.']);
    exit;
}

$query = $input['q'];
$endpoint = isset($input['type']) && $input['type'] === 'search' ? 'https://google.serper.dev/search' : 'https://google.serper.dev/places';
$envFile = __DIR__ . '/.env';
$env = file_exists($envFile) ? parse_ini_file($envFile) : [];
$apiKey = isset($env['SERPER_API_KEY']) ? $env['SERPER_API_KEY'] : '';

if (empty($apiKey)) {
    echo json_encode(['error' => 'API Key belum disetting di file backend/.env']);
    exit;
}

// Jika ini pencarian Google Search biasa (Deep Hunt)
if ($endpoint === 'https://google.serper.dev/search') {
    $postData = json_encode(['q' => $query, 'gl' => 'id', 'hl' => 'id']);
    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-API-KEY: ' . $apiKey, 'Content-Type: application/json']);
    
    $response = curl_exec($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpcode !== 200) {
        http_response_code($httpcode);
        echo $response;
        exit;
    }
    echo $response;
    exit;
}

// FITUR DATA MULTIPLIER: Jika type = places, perbanyak variasi kata kunci untuk menjaring data maksimal
$queries = [
    $query,
    $query . " terdekat",
    $query . " terbaik",
    $query . " populer",
    $query . " murah",
    $query . " baru",
    $query . " pinggir jalan",
    $query . " 24 jam",
    "Pusat " . $query,
    "Toko " . $query,
    "Usaha " . $query,
    "Grosir " . $query
];

$mh = curl_multi_init();
$curl_handles = [];

foreach ($queries as $i => $q) {
    $postData = json_encode(['q' => $q, 'gl' => 'id', 'hl' => 'id']);
    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-API-KEY: ' . $apiKey, 'Content-Type: application/json']);
    
    $curl_handles[$i] = $ch;
    curl_multi_add_handle($mh, $ch);
}

// Eksekusi semua secara paralel
$running = null;
do {
    curl_multi_exec($mh, $running);
} while ($running);

$allPlaces = [];
$seenCids = [];

foreach ($curl_handles as $i => $ch) {
    $response = curl_multi_getcontent($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_multi_remove_handle($mh, $ch);
    
    if ($httpcode === 200) {
        $data = json_decode($response, true);
        if (isset($data['places'])) {
            foreach ($data['places'] as $place) {
                $id = isset($place['cid']) ? $place['cid'] : $place['title'];
                if (!in_array($id, $seenCids)) {
                    $seenCids[] = $id;
                    $allPlaces[] = $place;
                }
            }
        }
    }
}
curl_multi_close($mh);

// Kembalikan daftar places yang sudah digabung
echo json_encode(['places' => $allPlaces]);
?>
