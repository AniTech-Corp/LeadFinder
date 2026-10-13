/* ============================================================================
 * dokumen_template.js
 * ----------------------------------------------------------------------------
 * Template PDF Proposal & Invoice (client-side, jsPDF + AutoTable).
 *
 * Semua layout visual dokumen ADA DI FILE INI supaya mudah ditukar.
 * Data `doc` berasal dari backend (action=save_dokumen) dan dilengkapi di
 * app.js (items, subtotal, diskon, ppn, total, jatuh_tempo, no_seri).
 *
 * Ini fase FRONTEND: perhitungan pajak/diskon & nomor seri dilakukan di klien.
 * ==========================================================================*/

const DOKUMEN_PERUSAHAAN = {
    nama: 'AniTech',
    nama_upper: 'ANITECH',
    alamat: 'Puri Gading Blok J4 No 8 Cluster Vila Ubud, RT002 RW011, Kel. Jatimelati, Kec. Pondok Melati, Kota Bekasi, 17414',
    kontak: '08132151962',
    logo: 'assets/logo/Logo AniTech Transparan.webp',
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
        const d = new Date(String(str || '').replace(' ', 'T'));
        if (isNaN(d.getTime())) return str || '-';
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return str || '-'; }
}

function dokumenLabelStatus(s) {
    const map = { 'Belum Bayar': 'Belum Dibayar', 'DP': 'DP', 'Lunas': 'Lunas' };
    return map[s] || s;
}

// --- Logo loader: WEBP -> canvas -> PNG dataURL (agar kompatibel dgn jsPDF) ---
let _dokumenLogoCache = null;
function dokumenLoadLogo() {
    return new Promise(resolve => {
        if (_dokumenLogoCache !== null) return resolve(_dokumenLogoCache || null);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                _dokumenLogoCache = { dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight };
            } catch (e) {
                _dokumenLogoCache = false;
            }
            resolve(_dokumenLogoCache || null);
        };
        img.onerror = () => { _dokumenLogoCache = false; resolve(null); };
        img.src = encodeURI(DOKUMEN_PERUSAHAAN.logo);
    });
}

function dokumenFilename(doc) {
    const nama = (doc.klien && doc.klien.nama ? doc.klien.nama : 'klien').replace(/[^a-zA-Z0-9]+/g, '_');
    const no = (doc.no_seri || doc.no_dokumen || '').replace(/[^a-zA-Z0-9]+/g, '_');
    return `${doc.jenis}_${nama}_${no}.pdf`;
}

// --- Renderer utama (dipakai Proposal & Invoice) ---
async function dokumenRender(doc, kind) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const P = DOKUMEN_PERUSAHAAN;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const M = 40;
    const isInvoice = kind === 'invoice';
    const logo = await dokumenLoadLogo();

    // ================= HEADER =================
    // Kiri: nama + alamat + kontak
    pdf.setFont('times', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(17, 24, 39);
    pdf.text(P.nama, M, 60);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    const addrLines = pdf.splitTextToSize(P.alamat, 260);
    pdf.text(addrLines, M, 76);
    let leftBottom = 76 + addrLines.length * 11;
    pdf.text('Telp: ' + P.kontak, M, leftBottom + 2);
    leftBottom += 2;

    // Kanan: logo + nomor seri
    let rightBottom = 46;
    if (logo) {
        const lw = 60;
        const lh = lw * (logo.h / logo.w);
        pdf.addImage(logo.dataUrl, 'PNG', pageW - M - lw, 40, lw, lh);
        rightBottom = 40 + lh;
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text('No. ' + (doc.no_seri || doc.no_dokumen || '-'), pageW - M, rightBottom + 14, { align: 'right' });
    rightBottom += 14;

    let y = Math.max(leftBottom, rightBottom) + 18;
    pdf.setDrawColor(P.warna.r, P.warna.g, P.warna.b);
    pdf.setLineWidth(1.2);
    pdf.line(M, y, pageW - M, y);
    y += 22;

    // ================= 3 KOLOM META =================
    const metaH = 42;
    pdf.setFillColor(248, 250, 252);
    pdf.rect(M, y, pageW - 2 * M, metaH, 'F');
    const colW = (pageW - 2 * M) / 3;
    const metaCols = isInvoice
        ? [
            { label: 'TANGGAL TERBIT', value: dokumenFormatTanggal(doc.tanggal_terbit || doc.tanggal) },
            { label: 'JATUH TEMPO', value: doc.jatuh_tempo ? dokumenFormatTanggal(doc.jatuh_tempo) : '-' },
            { label: 'STATUS', value: dokumenLabelStatus(doc.status_bayar) }
        ]
        : [
            { label: 'TANGGAL TERBIT', value: dokumenFormatTanggal(doc.tanggal_terbit || doc.tanggal) },
            { label: 'BERLAKU HINGGA', value: doc.jatuh_tempo ? dokumenFormatTanggal(doc.jatuh_tempo) : '-' },
            { label: 'STATUS', value: dokumenLabelStatus(doc.status_bayar) }
        ];
    metaCols.forEach((c, i) => {
        const x = M + 16 + i * colW;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(c.label, x, y + 15);
        pdf.setFontSize(10.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(String(c.value), x, y + 31);
    });
    y += metaH + 20;

    // ================= PENERIMA (kotak abu-abu) =================
    const klien = doc.klien || {};
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    const namaLines = pdf.splitTextToSize(klien.nama || '-', pageW - 2 * M - 32);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const klienAddrLines = pdf.splitTextToSize(klien.alamat || '-', pageW - 2 * M - 32);
    const boxH = 22 + namaLines.length * 14 + klienAddrLines.length * 12 + 16;

    pdf.setFillColor(241, 245, 249);
    pdf.rect(M, y, pageW - 2 * M, boxH, 'F');
    let by = y + 16;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(isInvoice ? 'DITAGIHKAN KEPADA' : 'KEPADA', M + 16, by);
    by += 16;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(namaLines, M + 16, by);
    by += namaLines.length * 14;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(klienAddrLines, M + 16, by);
    by += klienAddrLines.length * 12;
    if (klien.telepon) {
        pdf.text('Telp/WA: ' + klien.telepon, M + 16, by);
    }
    y += boxH + 22;

    // ================= TABEL RINCIAN 5 KOLOM =================
    const body = (doc.items || []).map(it => ([
        it.deskripsi,
        String(it.qty != null ? it.qty : 1),
        it.satuan || 'Paket',
        { content: dokumenFormatRupiah(it.harga_satuan), styles: { halign: 'right' } },
        { content: dokumenFormatRupiah(it.total), styles: { halign: 'right' } }
    ]));

    pdf.autoTable({
        startY: y,
        head: [['Deskripsi', 'Qty', 'Satuan', 'Harga Satuan', 'Total']],
        body: body,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 6, valign: 'middle', lineColor: [226, 232, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [P.warna.r, P.warna.g, P.warna.b], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 70, halign: 'center' },
            3: { cellWidth: 100, halign: 'right' },
            4: { cellWidth: 100, halign: 'right' }
        },
        margin: { left: M, right: M }
    });
    y = pdf.lastAutoTable.finalY + 20;

    // ================= RINGKASAN NOMINAL =================
    const boxX = pageW - M - 230;
    const rowGap = 18;
    const sumRows = [
        ['SUBTOTAL', dokumenFormatRupiah(doc.subtotal)],
        ['DISKON', doc.diskon ? ('- ' + dokumenFormatRupiah(doc.diskon)) : dokumenFormatRupiah(0)],
        ['PPN ' + (doc.ppn_persen || 0) + '%', dokumenFormatRupiah(doc.ppn_nominal)]
    ];
    let sy = y;
    sumRows.forEach(r => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        pdf.setTextColor(71, 85, 105);
        pdf.text(r[0], boxX, sy);
        pdf.setTextColor(15, 23, 42);
        pdf.text(r[1], pageW - M, sy, { align: 'right' });
        sy += rowGap;
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.8);
    pdf.line(boxX, sy - 7, pageW - M, sy - 7);
    sy += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text('TOTAL TAGIHAN', boxX, sy + 4);
    pdf.setTextColor(P.warna.r, P.warna.g, P.warna.b);
    pdf.text(dokumenFormatRupiah(doc.grand_total), pageW - M, sy + 4, { align: 'right' });
    sy += 22;

    // Catatan termin DP
    if (isInvoice && doc.termin === 'dp') {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(22, 163, 74);
        pdf.text('Termin DP 50% \u2192 Tagihan saat ini: ' + dokumenFormatRupiah(doc.total_tagihan), boxX, sy + 4);
        sy += 18;
    }
    y = sy + 16;

    // ================= FOOTER =================
    if (y > pageH - 240) { pdf.addPage(); y = 60; }

    if (isInvoice) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(22, 101, 52);
        pdf.text('INSTRUKSI PEMBAYARAN', M, y);
        y += 14;
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        pdf.text('Silakan transfer ke rekening berikut:', M, y);
        y += 13;
        P.bank.forEach(b => { pdf.text(`Bank ${b.bank}: ${b.no} a.n ${b.atas}`, M, y); y += 12; });
        pdf.setTextColor(100, 116, 139);
        pdf.text('Cantumkan No. ' + (doc.no_seri || doc.no_dokumen) + ' pada berita transfer.', M, y + 2);
        y += 22;
    } else {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(30, 64, 175);
        pdf.text('KETERANGAN PROPOSAL', M, y);
        y += 14;
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        const ket = 'Harga yang tercantum berlaku selama 14 hari sejak tanggal terbit. Jika setuju, silakan hubungi tim kami untuk proses administrasi selanjutnya.';
        const ketLines = pdf.splitTextToSize(ket, pageW - 2 * M);
        pdf.text(ketLines, M, y);
        y += ketLines.length * 12 + 10;
    }

    if (doc.catatan) {
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(15, 23, 42);
        pdf.text('Catatan:', M, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        const cl = pdf.splitTextToSize(doc.catatan, pageW - 2 * M);
        pdf.text(cl, M, y + 13);
        y += 13 + cl.length * 12 + 8;
    }

    // Tanda tangan
    const sigX = pageW - M - 160;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Hormat Kami,', sigX, y + 6);
    pdf.setDrawColor(15, 23, 42);
    pdf.line(sigX, y + 56, sigX + 140, y + 56);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(P.nama, sigX, y + 68);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text('Direktur', sigX, y + 80);

    // Footer halaman
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text('Dokumen ini digenerate otomatis oleh sistem Lead Finder Anitech.', pageW / 2, pageH - 30, { align: 'center' });
    pdf.text('\u00A9 ' + new Date().getFullYear() + ' ' + P.nama + '. All rights reserved.', pageW / 2, pageH - 20, { align: 'center' });

    pdf.save(dokumenFilename(doc));
}

function buildProposalPdf(doc) {
    return dokumenRender(doc, 'proposal');
}

function buildInvoicePdf(doc) {
    return dokumenRender(doc, 'invoice');
}
