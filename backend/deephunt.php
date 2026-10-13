<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, TRUE);

$website = isset($input['website']) ? $input['website'] : '';
$phone = isset($input['phone']) ? $input['phone'] : '';

$result = [
    'hasWa' => false,
    'hasIg' => false,
    'hasFb' => false,
    'hasTiktok' => false,
    'hasX' => false,
    'scale' => 'Kecil',
    'error' => null
];

// Check phone number from Google Places
if (!empty($phone)) {
    // Basic heuristic: if it's a mobile number (starts with 08 or +628 in Indonesia), high chance of WA
    $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
    if (strpos($cleanPhone, '628') === 0 || strpos($cleanPhone, '08') === 0) {
        $result['hasWa'] = true;
    }
}

if (!empty($website)) {
    // Ensure URL has scheme
    if (strpos($website, 'http') !== 0) {
        $website = 'http://' . $website;
    }

    $ch = curl_init($website);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 2);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5); // 5 seconds max so it doesn't hang
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $html = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($html) {
        // Search for WA links
        if (stripos($html, 'wa.me') !== false || stripos($html, 'api.whatsapp.com') !== false || stripos($html, 'whatsapp://') !== false) {
            $result['hasWa'] = true;
        }
        // Search for IG links
        if (stripos($html, 'instagram.com') !== false) {
            $result['hasIg'] = true;
        }
        // Search for FB links
        if (stripos($html, 'facebook.com') !== false) {
            $result['hasFb'] = true;
        }
        // Search for TikTok links
        if (stripos($html, 'tiktok.com') !== false) {
            $result['hasTiktok'] = true;
        }
        // Search for X / Twitter links
        if (stripos($html, 'twitter.com') !== false || stripos($html, 'x.com') !== false) {
            $result['hasX'] = true;
        }

        // Business Scale Detection (Regex)
        $cleanText = strip_tags($html);
        if (preg_match('/\b(PT\.?|Tbk\.?|nasional|karir|investor|banyak cabang)\b/i', $cleanText)) {
            $result['scale'] = 'Besar';
        } elseif (preg_match('/\b(CV\.?|PT skala kecil|cabang)\b/i', $cleanText)) {
            $result['scale'] = 'Menengah';
        } else {
            $result['scale'] = 'Kecil';
        }
    } else {
        $result['error'] = 'Failed to crawl website: ' . $error;
    }
}

echo json_encode($result);
?>
