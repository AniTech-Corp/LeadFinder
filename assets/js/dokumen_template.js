/* ============================================================================
 * dokumen_template.js
 * ----------------------------------------------------------------------------
 * Template PDF Proposal & Invoice (client-side, jsPDF + AutoTable).
 *
 * PENTING:
 *   - Semua layout visual dokumen ADA DI FILE INI supaya mudah ditukar ketika
 *     template resmi dari tim Marketing & Sekretaris sudah turun.
 *   - TODO (PENDING APPROVAL): desain ini masih PLACEHOLDER. Ganti isi
 *     buildProposalPdf() / buildInvoicePdf() dengan template resmi setelah
 *     disetujui Ka Adnan & Pak Mecca. Struktur data `dokumen` yang dikirim
 *     dari backend (action=save_dokumen) tidak perlu diubah.
 * ==========================================================================*/

const DOKUMEN_PERUSAHAAN = {
    nama: 'ANITECH DIGITAL',
    tagline: 'IT Solution & Digital Agency',
    alamat: 'Jl. Teknologi Raya No. 99, Jakarta',
    kontak: 'Email: hello@anitech.id | WA: 0812-3456-7890',
    bank: [
        { bank: 'BCA', no: '1234567890', atas: 'PT Anitech Digital' },
        { bank: 'Mandiri', no: '0987654321', atas: 'PT Anitech Digital' }
    ],
    warna: { r: 30, g: 58, b: 138 } // #1e3a8a (primary)
};

function dokumenFormatRupiah(n) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n || 0));
}

function dokumenFormatTanggal(str) {
    try {
        const d = new Date((str || '').replace(' ', 'T'));
        if (isNaN(d.getTime())) return str;
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return str; }
}

function dokumenHeader(doc, pdf, title) {
    const P = DOKUMEN_PERUSAHAAN;
    const pageW = pdf.internal.pageSize.getWidth();

    // Nama perusahaan & info
    pdf.setFontSize(20);
    pdf.setTextColor(P.warna.r, P.warna.g, P.warna.b);
    pdf.setFont(undefined, 'bold');
    pdf.text(P.nama, 40, 46);

    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(P.tagline, 40, 60);
    pdf.text(P.alamat, 40, 72);
    pdf.text(P.kontak, 40, 84);

    // Judul dokumen (kanan)
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(title.toUpperCase(), pageW - 40, 46, { align: 'right' });

    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text('# ' + doc.no_dokumen, pageW - 40, 60, { align: 'right' });
    pdf.text('Tanggal: ' + dokumenFormatTanggal(doc.tanggal), pageW - 40, 72, { align: 'right' });

    // Garis pemisah
    pdf.setDrawColor(P.warna.r, P.warna.g, P.warna.b);
    pdf.setLineWidth(1.5);
    pdf.line(40, 96, pageW - 40, 96);
}

function dokumenKlienBox(doc, pdf, startY) {
    const klien = doc.klien || {};
    const pageW = pdf.internal.pageSize.getWidth();
    const rightX = pageW / 2 + 10;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text('KEPADA:', 40, startY);
    pdf.text('INFORMASI DOKUMEN:', rightX, startY);

    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(51, 65, 85);

    let y = startY + 14;
    pdf.text(klien.nama || '-', 40, y); y += 12;
    pdf.text(pdf.splitTextToSize(klien.alamat || '-', pageW / 2 - 60), 40, y); 
    y += 12 * Math.max(1, pdf.splitTextToSize(klien.alamat || '-', pageW / 2 - 60).length);
    pdf.text('Telp/WA: ' + (klien.telepon || '-'), 40, y);
    pdf.text('PIC: Bpk/Ibu Pimpinan', 40, y + 12);

    let ry = startY + 14;
    pdf.text('Jenis Dokumen: ' + doc.jenis, rightX, ry); ry += 12;
    pdf.text('Status: ' + doc.status_bayar, rightX, ry); ry += 12;
    pdf.text('Estimasi Pengerjaan: ' + ((doc.paket && doc.paket.estimasi_hari) || '-') + ' Hari Kerja', rightX, ry);

    return Math.max(y + 24, ry + 24);
}

function dokumenItemTable(doc, pdf, startY) {
    const P = DOKUMEN_PERUSAHAAN;
    const body = [];

    // Baris paket utama
    body.push([
        { content: doc.paket.nama + (doc.paket.deskripsi ? '\n' + doc.paket.deskripsi : ''), styles: { fontStyle: 'bold' } },
        { content: dokumenFormatRupiah(doc.paket.harga), styles: { halign: 'right' } }
    ]);

    // Baris fitur opsional
    (doc.fitur || []).forEach(f => {
        body.push([
            '- ' + f.nama,
            { content: dokumenFormatRupiah(f.harga), styles: { halign: 'right' } }
        ]);
    });

    // Subtotal fitur (kalau ada)
    if ((doc.fitur || []).length > 0) {
        body.push([
            { content: 'Subtotal Fitur Opsional', styles: { textColor: [100, 116, 139] } },
            { content: dokumenFormatRupiah(doc.subtotal_fitur), styles: { halign: 'right', textColor: [100, 116, 139] } }
        ]);
    }

    // Grand total
    body.push([
        { content: 'GRAND TOTAL', styles: { fontStyle: 'bold' } },
        { content: dokumenFormatRupiah(doc.grand_total), styles: { halign: 'right', fontStyle: 'bold', textColor: [P.warna.r, P.warna.g, P.warna.b] } }
    ]);

    // Tagihan aktif (invoice)
    if (doc.jenis === 'Invoice') {
        const label = doc.termin === 'dp' ? 'TAGIHAN AKTIF (DP 50%)' : 'TAGIHAN AKTIF (LUNAS)';
        body.push([
            { content: label, styles: { fontStyle: 'bold', textColor: [22, 163, 74] } },
            { content: dokumenFormatRupiah(doc.total_tagihan), styles: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] } }
        ]);
    }

    pdf.autoTable({
        startY: startY,
        head: [['Deskripsi Layanan & Paket', 'Harga']],
        body: body,
        styles: { fontSize: 9, cellPadding: 6, valign: 'middle' },
        headStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 120 } },
        margin: { left: 40, right: 40 }
    });

    return pdf.lastAutoTable.finalY + 20;
}

function dokumenFooter(doc, pdf, startY) {
    const P = DOKUMEN_PERUSAHAAN;
    const pageW = pdf.internal.pageSize.getWidth();

    if (doc.jenis === 'Invoice') {
        pdf.setFontSize(9);
        pdf.setTextColor(22, 101, 52);
        pdf.setFont(undefined, 'bold');
        pdf.text('INSTRUKSI PEMBAYARAN:', 40, startY);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(51, 65, 85);
        let y = startY + 14;
        pdf.text('Silakan lakukan transfer ke rekening berikut:', 40, y); y += 12;
        P.bank.forEach(b => {
            pdf.text(`Bank ${b.bank}: ${b.no} a.n ${b.atas}`, 40, y); y += 12;
        });
        pdf.setTextColor(100, 116, 139);
        pdf.text('Harap cantumkan nomor invoice ' + doc.no_dokumen + ' pada berita transfer.', 40, y + 4);
        startY = y + 24;
    } else {
        pdf.setFontSize(9);
        pdf.setTextColor(30, 64, 175);
        pdf.setFont(undefined, 'bold');
        pdf.text('KETERANGAN PROPOSAL:', 40, startY);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(51, 65, 85);
        const ket = 'Harga yang tercantum berlaku selama 14 hari sejak tanggal proposal ini diterbitkan. Jika Anda setuju, silakan hubungi tim sales kami untuk proses administrasi selanjutnya.';
        pdf.text(pdf.splitTextToSize(ket, pageW - 80), 40, startY + 14);
        startY += 14 + (pdf.splitTextToSize(ket, pageW - 80).length * 12) + 10;
    }

    // Catatan klien
    if (doc.catatan) {
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(15, 23, 42);
        pdf.text('Catatan / Permintaan Khusus:', 40, startY);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(51, 65, 85);
        const lines = pdf.splitTextToSize(doc.catatan, pageW - 80);
        pdf.text(lines, 40, startY + 14);
        startY += 14 + lines.length * 12 + 10;
    }

    // Tanda tangan
    const sigX = pageW - 200;
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(9);
    pdf.text('Hormat Kami,', sigX, startY);
    pdf.setDrawColor(15, 23, 42);
    pdf.line(sigX, startY + 60, sigX + 140, startY + 60);
    pdf.setFont(undefined, 'bold');
    pdf.text(P.nama, sigX, startY + 72);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text('Direktur Utama', sigX, startY + 84);

    // Footer halaman
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text('Dokumen ini digenerate secara otomatis oleh sistem Lead Finder Anitech.',
        pageW / 2, pageH - 30, { align: 'center' });
    pdf.text('\u00A9 ' + new Date().getFullYear() + ' ' + P.nama + '. All rights reserved.',
        pageW / 2, pageH - 20, { align: 'center' });
}

function dokumenBuild(doc, title) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    pdf.setFont('helvetica', 'normal');

    dokumenHeader(doc, pdf, title);
    const yKlien = dokumenKlienBox(doc, pdf, 120);
    const yTable = dokumenItemTable(doc, pdf, yKlien);
    dokumenFooter(doc, pdf, yTable);

    return pdf;
}

function dokumenFilename(doc) {
    const nama = (doc.klien && doc.klien.nama ? doc.klien.nama : 'klien').replace(/[^a-zA-Z0-9]+/g, '_');
    return `${doc.jenis}_${nama}_${doc.no_dokumen}.pdf`;
}

// TODO (PENDING APPROVAL): ganti layout dengan template resmi Marketing & Sekretaris.
function buildProposalPdf(doc) {
    const pdf = dokumenBuild(doc, 'Proposal');
    pdf.save(dokumenFilename(doc));
}

// TODO (PENDING APPROVAL): ganti layout dengan template resmi Marketing & Sekretaris.
function buildInvoicePdf(doc) {
    const pdf = dokumenBuild(doc, 'Invoice');
    pdf.save(dokumenFilename(doc));
}
