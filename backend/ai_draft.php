<?php
header('Content-Type: application/json');
$input = json_decode(file_get_contents('php://input'), true);

$nama = $input['nama'] ?? 'Pemilik Bisnis';
$missing = $input['missing'] ?? []; // misal: ['website', 'instagram']

$masalah = empty($missing) ? 'beberapa aspek digital' : implode(' dan ', $missing);
$solusi = in_array('website', $missing) ? 'jasa pembuatan website profesional' : 'layanan optimasi digital';

$envFile = __DIR__ . '/.env';
$env = file_exists($envFile) ? parse_ini_file($envFile) : [];
$apiKey = $env['OPENROUTER_API_KEY'] ?? '';

if (empty($apiKey)) {
    echo json_encode(['error' => 'API Key OpenRouter belum disetting di backend/.env']);
    exit;
}

$url = "https://openrouter.ai/api/v1/chat/completions";

$prompt = "Buatkan satu paragraf pesan sapaan WhatsApp (sales pitch) yang santai namun profesional untuk menawarkan $solusi kepada bisnis bernama '$nama'. Sebutkan bahwa mereka belum memaksimalkan $masalah mereka. Jangan gunakan salam formal seperti 'Yth.', gunakan sapaan 'Halo, perkenalkan saya dari tim digital agency...'. Buat agar terlihat natural dan tidak kaku (maksimal 3-4 kalimat).";

$data = [
    "model" => "openai/gpt-4o-mini",
    "messages" => [
        ["role" => "user", "content" => $prompt]
    ],
    "temperature" => 0.7
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $apiKey,
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpcode === 200 && $response) {
    $resData = json_decode($response, true);
    if (isset($resData['choices'][0]['message']['content'])) {
        $draft = trim($resData['choices'][0]['message']['content']);
        echo json_encode(['status' => 'success', 'draft' => $draft]);
        exit;
    }
}

// Fallback jika API gagal
$draftFallback = "Halo, perkenalkan saya dari tim digital agency. Saya menemukan *$nama* di Google Maps dan melihat potensinya sangat besar.\n\nNamun saya perhatikan sepertinya *$nama* belum memaksimalkan *$masalah*. Di era sekarang, hal ini penting untuk menjaring pelanggan baru.\n\nKami memiliki solusi _$solusi_ yang bisa membantu meningkatkan kunjungan pelanggan Anda hingga 3x lipat. Apakah Bapak/Ibu berkenan jika saya kirimkan portofolio kami?";
echo json_encode(['status' => 'success', 'draft' => $draftFallback]);
?>
