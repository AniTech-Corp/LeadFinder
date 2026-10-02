<?php
header('Content-Type: application/json');
$input = json_decode(file_get_contents('php://input'), true);

$nama = $input['nama'] ?? 'Pemilik Bisnis';
$missing = $input['missing'] ?? []; // misal: ['website', 'instagram']

$masalah = empty($missing) ? 'beberapa aspek digital' : implode(' dan ', $missing);
$solusi = in_array('website', $missing) ? 'jasa pembuatan website profesional' : 'layanan optimasi digital';

$draft = "Halo, perkenalkan saya dari tim digital agency. Saya menemukan *$nama* di Google Maps dan melihat potensinya sangat besar.\n\nNamun saya perhatikan sepertinya *$nama* belum memaksimalkan *$masalah*. Di era sekarang, hal ini penting untuk menjaring pelanggan baru.\n\nKami memiliki solusi _$solusi_ yang bisa membantu meningkatkan kunjungan pelanggan Anda hingga 3x lipat. Apakah Bapak/Ibu berkenan jika saya kirimkan portofolio kami?";

// Simulate slight delay like an AI API
sleep(1);

echo json_encode(['status' => 'success', 'draft' => $draft]);
?>
