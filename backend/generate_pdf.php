<?php
require '../vendor/autoload.php';
use Dompdf\Dompdf;
use Dompdf\Options;

header('Content-Type: application/json');

$host = '127.0.0.1';
$db   = 'leadscout';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$optionsDb = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $optionsDb);
} catch (\PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'DB Connection failed']);
    exit;
}

$cid = $_POST['cid'] ?? '';
$jenis = $_POST['jenis'] ?? ''; // 'proposal' or 'invoice'
$id_layanan = $_POST['id_layanan'] ?? '';
$termin = $_POST['termin'] ?? 'full'; // 'full' or 'dp'

if (!$cid || !$jenis || !$id_layanan) {
    echo json_encode(['status' => 'error', 'message' => 'Missing parameters']);
    exit;
}

// Fetch Lead Data
$stmt = $pdo->prepare("SELECT * FROM leads WHERE cid = ?");
$stmt->execute([$cid]);
$lead = $stmt->fetch();
if (!$lead) {
    echo json_encode(['status' => 'error', 'message' => 'Lead not found']);
    exit;
}

// Fetch Layanan Data
$stmt2 = $pdo->prepare("SELECT * FROM tbl_katalog_layanan WHERE id_layanan = ?");
$stmt2->execute([$id_layanan]);
$layanan = $stmt2->fetch();
if (!$layanan) {
    echo json_encode(['status' => 'error', 'message' => 'Layanan not found']);
    exit;
}

$harga = $layanan['harga'];
$tagihan_aktif = $harga;
$status_bayar = 'Belum Bayar';

if ($jenis === 'invoice' && $termin === 'dp') {
    $tagihan_aktif = $harga * 0.5;
    $status_bayar = 'DP';
}

$no_dokumen = strtoupper(substr($jenis, 0, 3)) . '-' . date('Ym') . '-' . rand(1000, 9999);

// Simpan/Update Dokumen ke Database
$stmt3 = $pdo->prepare("INSERT INTO tbl_dokumen (no_dokumen, cid, jenis, id_layanan, total_tagihan, status_bayar) 
                        VALUES (?, ?, ?, ?, ?, ?)");
$stmt3->execute([$no_dokumen, $cid, ucfirst($jenis), $id_layanan, $tagihan_aktif, $status_bayar]);

// HTML untuk PDF
$html = '
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>'.$no_dokumen.'</title>
    <style>
        body { font-family: "Helvetica", "Arial", sans-serif; color: #333; line-height: 1.5; margin: 0; padding: 20px; }
        .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .header table { width: 100%; }
        .header h1 { color: #2563eb; margin: 0; font-size: 28px; text-transform: uppercase; }
        .header p { margin: 2px 0; font-size: 12px; color: #64748b; }
        .info-section { margin-bottom: 40px; width: 100%; }
        .info-section td { vertical-align: top; width: 50%; }
        .info-title { font-weight: bold; font-size: 14px; margin-bottom: 5px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
        .info-content { font-size: 12px; }
        .table-items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .table-items th { background-color: #f8fafc; color: #334155; font-size: 12px; font-weight: bold; padding: 12px 15px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        .table-items td { padding: 12px 15px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
        .total-row td { font-weight: bold; font-size: 14px; background-color: #f8fafc; }
        .text-right { text-align: right; }
        .footer { margin-top: 50px; font-size: 12px; color: #64748b; text-align: center; }
        .signature-box { margin-top: 50px; width: 200px; float: right; text-align: center; }
        .signature-line { border-bottom: 1px solid #0f172a; margin-top: 60px; margin-bottom: 5px; }
    </style>
</head>
<body>

<div class="header">
    <table>
        <tr>
            <td>
                <h1>ANITECH DIGITAL</h1>
                <p>IT Solution & Digital Agency</p>
                <p>Jl. Teknologi Raya No. 99, Jakarta</p>
                <p>Email: hello@anitech.id | WA: 0812-3456-7890</p>
            </td>
            <td class="text-right">
                <h2 style="margin:0; font-size:24px; color:#0f172a;">'.strtoupper($jenis).'</h2>
                <p style="font-weight:bold; color:#333;"># '.$no_dokumen.'</p>
                <p>Tanggal: '.date('d M Y').'</p>
            </td>
        </tr>
    </table>
</div>

<table class="info-section">
    <tr>
        <td style="padding-right: 20px;">
            <div class="info-title">KEPADA:</div>
            <div class="info-content">
                <strong>'.htmlspecialchars($lead['title']).'</strong><br>
                '.htmlspecialchars($lead['address']).'<br>
                Telp/WA: '.htmlspecialchars($lead['phone']).'<br>
                PIC: Bpk/Ibu Pimpinan
            </div>
        </td>
        <td>
            <div class="info-title">INFORMASI DOKUMEN:</div>
            <div class="info-content">
                Jenis Dokumen: <strong>'.ucfirst($jenis).'</strong><br>
                Status: <strong>'.$status_bayar.'</strong><br>
                Estimasi Pengerjaan: <strong>'.$layanan['estimasi_hari'].' Hari Kerja</strong>
            </div>
        </td>
    </tr>
</table>

<table class="table-items">
    <thead>
        <tr>
            <th>Deskripsi Layanan & Paket</th>
            <th class="text-right">Harga</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <strong>'.htmlspecialchars($layanan['nama_paket']).'</strong><br>
                <span style="font-size:11px; color:#64748b;">'.htmlspecialchars($layanan['deskripsi_fitur']).'</span>
            </td>
            <td class="text-right">Rp '.number_format($harga, 0, ',', '.').'</td>
        </tr>
';

if ($jenis === 'invoice' && $termin === 'dp') {
    $html .= '
        <tr>
            <td><strong>Tagihan (DP 50%)</strong></td>
            <td class="text-right">Rp '.number_format($tagihan_aktif, 0, ',', '.').'</td>
        </tr>
    ';
}

$html .= '
        <tr class="total-row">
            <td class="text-right">TOTAL TAGIHAN AKTIF</td>
            <td class="text-right" style="color:#2563eb;">Rp '.number_format($tagihan_aktif, 0, ',', '.').'</td>
        </tr>
    </tbody>
</table>
';

if ($jenis === 'invoice') {
    $html .= '
    <div style="background-color: #f0fdf4; padding: 15px; border-left: 4px solid #16a34a; font-size: 12px; margin-bottom: 20px;">
        <strong>INSTRUKSI PEMBAYARAN:</strong><br>
        Silakan lakukan transfer ke rekening berikut:<br>
        Bank BCA: <strong>1234567890</strong> a.n PT Anitech Digital<br>
        Bank Mandiri: <strong>0987654321</strong> a.n PT Anitech Digital<br><br>
        <em>Harap cantumkan nomor invoice <strong>'.$no_dokumen.'</strong> pada berita transfer.</em>
    </div>
    ';
} else {
    $html .= '
    <div style="background-color: #eff6ff; padding: 15px; border-left: 4px solid #2563eb; font-size: 12px; margin-bottom: 20px;">
        <strong>KETERANGAN PROPOSAL:</strong><br>
        Harga yang tercantum berlaku selama 14 hari sejak tanggal proposal ini diterbitkan. Jika Anda setuju, silakan hubungi tim sales kami untuk proses administrasi selanjutnya.
    </div>
    ';
}

$html .= '
<div class="signature-box">
    <div style="font-size: 12px;">Hormat Kami,</div>
    <div class="signature-line"></div>
    <div style="font-size: 12px; font-weight: bold;">Anitech Digital</div>
    <div style="font-size: 11px; color: #64748b;">Direktur Utama</div>
</div>

<div style="clear:both;"></div>

<div class="footer">
    Dokumen ini digenerate secara otomatis oleh sistem Lead Finder Anitech.<br>
    &copy; '.date('Y').' Anitech Digital. All rights reserved.
</div>

</body>
</html>
';

$options = new Options();
$options->set('isHtml5ParserEnabled', true);
$options->set('isRemoteEnabled', true);
$dompdf = new Dompdf($options);
$dompdf->loadHtml($html);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();

$output = $dompdf->output();
$filename = $jenis . "_" . preg_replace('/[^a-zA-Z0-9]+/', '_', $lead['title']) . "_" . time() . ".pdf";
$filepath = "../downloads/" . $filename;

if (!file_exists('../downloads')) {
    mkdir('../downloads', 0777, true);
}

file_put_contents($filepath, $output);

// Kembalikan response JSON yang berisi link file PDF
echo json_encode([
    'status' => 'success',
    'file_url' => 'downloads/' . $filename,
    'filename' => $filename,
    'no_dokumen' => $no_dokumen
]);
