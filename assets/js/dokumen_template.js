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

const DOKUMEN_BRANDS = {
    anitech: {
        id: 'anitech',
        nama: 'ANITECH STUDIO',
        nama_upper: 'ANITECH STUDIO',
        alamat: 'Puri Gading Blok J4 No 8 Cluster Vila Ubud, RT002 RW011, Kel. Jatimelati, Kec. Pondok Melati, Kota Bekasi, 17414',
        kontak: '081977241552',
        logo: 'assets/logo/Logo AniTech Transparan.webp',
        bank: [
            { bank: 'BCA', no: '6872202613', atas: 'Mecca Alain Noor Sheehan' }
        ],
        warna: { r: 30, g: 58, b: 138 } // #1e3a8a (primary)
    },
    klir_by_anitech: {
        id: 'klir_by_anitech',
        nama: 'KLIR BY ANITECH',
        nama_upper: 'KLIR BY ANITECH',
        alamat: 'Puri Gading Blok J4 No 8 Cluster Vila Ubud, RT002 RW011, Kel. Jatimelati, Kec. Pondok Melati, Kota Bekasi, 17414',
        kontak: '081977241552',
        logo: 'assets/logo/[Text Hitam] Logo KLIR V2 Transparan.webp',
        bank: [
            { bank: 'BCA', no: '6872202613', atas: 'Mecca Alain Noor Sheehan' }
        ],
        warna: { r: 0, g: 0, b: 0 }
    },
    klir: {
        id: 'klir',
        nama: 'KLIR STUDIO',
        nama_upper: 'KLIR STUDIO',
        alamat: 'Puri Gading Blok J4 No 8 Cluster Vila Ubud, RT002 RW011, Kel. Jatimelati, Kec. Pondok Melati, Kota Bekasi, 17414',
        kontak: '081977241552',
        logo: 'assets/logo/[Text Hitam] Logo KLIR V2 Transparan.webp',
        bank: [
            { bank: 'BCA', no: '6872202613', atas: 'Mecca Alain Noor Sheehan' }
        ],
        warna: { r: 0, g: 0, b: 0 }
    }
};

let DOKUMEN_BRAND_ID = 'anitech';
const DOKUMEN_PERUSAHAAN = DOKUMEN_BRANDS[DOKUMEN_BRAND_ID];

// Brand diambil dari settings backend bila tersedia; kalau tidak, pakai default di atas.
function dokumenBrandsMap() {
    const s = (typeof window !== 'undefined' && window.APP_SETTINGS && window.APP_SETTINGS.brands);
    return (s && typeof s === 'object' && Object.keys(s).length) ? s : DOKUMEN_BRANDS;
}

function dokumenFormatRupiah(n) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n || 0));
}

function dokumenFormatNominal(val) {
    if (val === 0 || val === '0' || val === 'Free') return 'Free';
    const num = typeof val === 'number' ? val : parseFloat(String(val || '').replace(/[^0-9.-]+/g, ''));
    if (isNaN(num) || num === 0) return 'Free';
    return new Intl.NumberFormat('id-ID').format(Math.round(num));
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
let _dokumenLogoCache = {};
function dokumenLoadLogo(brandId) {
    const brand = dokumenBrandsMap()[brandId];
    if (!brand) return Promise.resolve(null);
    const cache = _dokumenLogoCache[brand.logo];
    if (cache !== undefined) return Promise.resolve(cache);
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                _dokumenLogoCache[brand.logo] = { dataUrl, w: img.naturalWidth, h: img.naturalHeight };
            } catch (e) {
                _dokumenLogoCache[brand.logo] = false;
            }
            resolve(_dokumenLogoCache[brand.logo]);
        };
        img.onerror = () => { _dokumenLogoCache[brand.logo] = false; resolve(null); };
        img.src = encodeURI(brand.logo);
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
    const P = dokumenBrandsMap()[DOKUMEN_BRAND_ID] || DOKUMEN_BRANDS.anitech;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const M = 45;
    const isInvoice = kind === 'invoice';
    const logo = await dokumenLoadLogo(DOKUMEN_BRAND_ID);

    // ================= HEADER =================
    // Kiri: Nama Brand + Alamat + Kontak (telepon langsung tanpa prefix 'Telp')
    const brandTitle = (P.nama_upper || P.nama || 'KLIR STUDIO').toUpperCase();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(17);
    pdf.setTextColor(51, 65, 85);
    pdf.text(brandTitle, M, 58);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    const addrLines = pdf.splitTextToSize(P.alamat || '', 255);
    pdf.text(addrLines, M, 74);
    let leftBottom = 74 + addrLines.length * 11.5;
    if (P.kontak) {
        pdf.text(String(P.kontak), M, leftBottom + 1);
        leftBottom += 14;
    }

    // Kanan: Logo Brand + Nomor Dokumen tepat di bawah logo
    let rightBottom = 45;
    const docNo = doc.no_seri || doc.no_dokumen || (isInvoice ? 'INV/2026/10/001' : 'PRO/2026/10/001');
    const colW = 75;
    const colX = pageW - M - colW;

    if (logo) {
        const lw = 46;
        const lh = lw * (logo.h / logo.w);
        const lx = colX + (colW - lw) / 2;
        pdf.addImage(logo.dataUrl, 'PNG', lx, 38, lw, lh);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(51, 65, 85);
        pdf.text(docNo, colX + colW / 2, 38 + lh + 12, { align: 'center' });
        rightBottom = 38 + lh + 20;
    } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(51, 65, 85);
        pdf.text(docNo, pageW - M, 55, { align: 'right' });
        rightBottom = 65;
    }

    // ================= METADATA BAR (Tanggal terbit, jatuh tempo, status) =================
    let y = Math.max(leftBottom, rightBottom) + 16;
    pdf.setDrawColor(180, 190, 205);
    pdf.setLineWidth(0.8);
    pdf.line(M, y, pageW - M, y);

    y += 14;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Tanggal terbit', M + 50, y, { align: 'center' });
    pdf.text(isInvoice ? 'jatuh tempo' : 'Berlaku hingga', pageW / 2, y, { align: 'center' });
    pdf.text('status', pageW - M - 50, y, { align: 'center' });

    y += 15;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(dokumenFormatTanggal(doc.tanggal_terbit || doc.tanggal), M + 50, y, { align: 'center' });
    pdf.text(doc.jatuh_tempo ? dokumenFormatTanggal(doc.jatuh_tempo) : '', pageW / 2, y, { align: 'center' });
    pdf.text(dokumenLabelStatus(doc.status_bayar), pageW - M - 50, y, { align: 'center' });

    y += 12;
    pdf.line(M, y, pageW - M, y);

    // ================= DITAGIHKAN KEPADA (Kotak Soft Cyan) =================
    y += 18;
    const klien = doc.klien || {};
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    const klienAddrLines = pdf.splitTextToSize(klien.alamat || '-', pageW - 2 * M - 24);
    const klienNamaLines = pdf.splitTextToSize(klien.nama || '-', pageW - 2 * M - 24);
    let boxH = 12 + 13 + (klienNamaLines.length * 13) + 3 + (klienAddrLines.length * 11) + 10;
    if (klien.telepon) boxH += 12;

    pdf.setFillColor(230, 247, 246); // Soft cyan / mint (#e6f7f6)
    pdf.rect(M, y, pageW - 2 * M, boxH, 'F');

    let by = y + 13;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(isInvoice ? 'DITAGIHKAN KEPADA' : 'KEPADA', M + 12, by);

    by += 14;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(klienNamaLines, M + 12, by);

    by += klienNamaLines.length * 13 + 3;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text(klienAddrLines, M + 12, by);
    by += klienAddrLines.length * 11;

    if (klien.telepon) {
        pdf.text('Telp/WA: ' + klien.telepon, M + 12, by + 2);
    }
    y += boxH + 18;

    // ================= TABEL RINCIAN 5 KOLOM (Gaya Minimalist Berselang-Seling Cyan) =================
    const body = (doc.items || []).map(it => ([
        it.deskripsi || '-',
        String(it.qty != null ? it.qty : 1),
        it.satuan || 'Paket',
        dokumenFormatNominal(it.harga_satuan),
        dokumenFormatNominal(it.total)
    ]));

    pdf.autoTable({
        startY: y,
        head: [['Deskripsi', 'Qty', 'Satuan', 'Harga satuan', 'Total']],
        body: body,
        theme: 'plain',
        styles: {
            fontSize: 9,
            cellPadding: 7,
            valign: 'middle',
            textColor: [15, 23, 42]
        },
        headStyles: {
            fillColor: false,
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 9.5,
            lineWidth: { top: 0.8, bottom: 0.8, left: 0, right: 0 },
            lineColor: [180, 190, 205],
            cellPadding: 7
        },
        columnStyles: {
            0: { cellWidth: 'auto', fontStyle: 'bold' },
            1: { cellWidth: 45, halign: 'center' },
            2: { cellWidth: 65, halign: 'center' },
            3: { cellWidth: 95, halign: 'right' },
            4: { cellWidth: 95, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: function(data) {
            if (data.section === 'head') {
                if (data.column.index === 1 || data.column.index === 2) {
                    data.cell.styles.halign = 'center';
                } else if (data.column.index === 3 || data.column.index === 4) {
                    data.cell.styles.halign = 'right';
                }
            }
            if (data.section === 'body') {
                // Baris ganjil/genap selang-seling warna cyan lembut
                if (data.row.index % 2 === 0) {
                    data.cell.styles.fillColor = [230, 247, 246];
                } else {
                    data.cell.styles.fillColor = [255, 255, 255];
                }
            }
        },
        margin: { left: M, right: M }
    });

    y = pdf.lastAutoTable.finalY;
    pdf.setDrawColor(180, 190, 205);
    pdf.setLineWidth(0.8);
    pdf.line(M, y, pageW - M, y);

    // ================= RINGKASAN NOMINAL (SUBTOTAL, DISKON, TOTAL TAGIHAN) =================
    y += 18;
    const boxW = 210;
    const boxX = pageW - M - boxW;
    const ruleSummary = (yy) => {
        pdf.setDrawColor(180, 190, 205);
        pdf.setLineWidth(0.7);
        pdf.line(boxX, yy, pageW - M, yy);
    };

    const invoiceWithoutPpn = isInvoice && doc.ppn_aktif === false;
    const drawSummary = (startY) => {
        let sy = startY;
        const summaryRow = (label, nilai, isBold = false) => {
            sy += 14;
            pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
            pdf.setFontSize(isBold ? 9.5 : 9);
            pdf.setTextColor(isBold ? 15 : 71, isBold ? 23 : 85, isBold ? 42 : 105);
            pdf.text(label, boxX, sy);
            pdf.text(String(nilai), pageW - M, sy, { align: 'right' });
            sy += 3;
        };

        summaryRow('SUBTOTAL', dokumenFormatNominal(doc.subtotal));
        summaryRow('DISKON', doc.diskon ? dokumenFormatNominal(doc.diskon) : '0');
        if (doc.ppn_nominal && doc.ppn_nominal > 0) {
            summaryRow('PPN ' + (doc.ppn_persen || 0) + '%', dokumenFormatNominal(doc.ppn_nominal));
        }
        ruleSummary(sy + 2);
        sy += 3;
        summaryRow('TOTAL TAGIHAN', dokumenFormatNominal(doc.grand_total), true);
        ruleSummary(sy + 2);
        sy += 3;

        if (isInvoice && doc.termin === 'dp') {
            summaryRow('TAGIHAN SAAT INI (DP 50%)', dokumenFormatNominal(doc.total_tagihan), true);
            ruleSummary(sy + 2);
            sy += 3;
        }

        return sy;
    }

    if (invoiceWithoutPpn) {
        y += 40;
    } else {
        y = drawSummary(y + 18) + 25;
    }

    const banks = (Array.isArray(P.bank) && P.bank.length) ? P.bank : [
        { bank: 'BCA', no: '6872202613', atas: 'Mecca Alain Noor Sheehan' }
    ];
    const bk = banks[0];

    if (invoiceWithoutPpn) {
        const paymentLines = pdf.splitTextToSize(
            `Pembayaran via transfer ke ${bk.bank}: ${bk.no} a/n ${bk.atas}.`,
            boxX - M - 26
        );
        const summaryRows = 3 + (isInvoice && doc.termin === 'dp' ? 1 : 0);
        const infoSectionH = Math.max(76, 41 + paymentLines.length * 11 + 12, summaryRows * 17 + 23);

        if (y + infoSectionH > pageH - 40) {
            pdf.addPage();
            y = 50;
        }

        pdf.setDrawColor(180, 190, 205);
        pdf.setLineWidth(0.8);
        pdf.line(M, y, pageW - M, y);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text('Informasi Pembayaran', M + 8, y + 16);
        pdf.setFontSize(8.5);
        pdf.setTextColor(51, 65, 85);
        pdf.text(paymentLines, M + 8, y + 41);

        drawSummary(y);
        y += infoSectionH + 15;
    } else {
        // ================= KOTAK INFORMASI PEMBAYARAN (ROUNDED BORDER) =================
        const infoBoxH = isInvoice ? 76 : 65;
        if (y + infoBoxH > pageH - 40) {
            pdf.addPage();
            y = 50;
        }

        pdf.setDrawColor(100, 116, 139);
        pdf.setLineWidth(0.8);
        pdf.roundedRect(M, y, pageW - 2 * M, infoBoxH, 8, 8, 'S');

        let iy = y + 16;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(15, 23, 42);

        if (isInvoice) {
            pdf.text('Informasi Pembayaran', M + 14, iy);
            iy += 13;

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(51, 65, 85);
            pdf.text(`1. Pembayaran via transfer ke ${bk.bank}: ${bk.no} a/n ${bk.atas}.`, M + 14, iy);

            iy += 12;
            pdf.text('2. Bagi pelanggan yang sudah memotong PPh 23, diwajibkan untuk mengirimkan E-Bupot PPh 23 ke email tax@7ion.co.id.', M + 14, iy);

            iy += 12;
            pdf.text('3. Tarif pajak pada invoice adalah 12% dari DPP Nilai Lain (PMK 131/2024).', M + 14, iy);

            y += infoBoxH + 15;
        } else {
            pdf.text('Keterangan Proposal', M + 14, iy);
            iy += 13;

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(51, 65, 85);
            pdf.text('1. Harga yang tercantum berlaku selama 14 hari sejak tanggal proposal ini diterbitkan.', M + 14, iy);

            iy += 12;
            pdf.text('2. Jika Anda menyetujui penawaran ini, silakan hubungi tim kami untuk proses administrasi selanjutnya.', M + 14, iy);

            y += infoBoxH + 15;
        }
    }

    if (doc.catatan) {
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(8.5);
        pdf.text('Catatan:', M, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        const cl = pdf.splitTextToSize(doc.catatan, pageW - 2 * M);
        pdf.text(cl, M, y + 11);
        y += 11 + cl.length * 11 + 6;
    }

    pdf.save(dokumenFilename(doc));
}

function buildProposalPdf(doc) {
    DOKUMEN_BRAND_ID = 'anitech';
    return dokumenRender(doc, 'proposal');
}

function buildInvoicePdf(doc) {
    DOKUMEN_BRAND_ID = doc.brand || 'anitech';
    return dokumenRender(doc, 'invoice');
}
