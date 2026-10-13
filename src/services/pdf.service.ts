import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface GeneratePdfParams {
  noDokumen: string;
  jenis: 'proposal' | 'invoice';
  leadTitle: string;
  leadAddress: string;
  leadPhone: string;
  namaPaket: string;
  deskripsiFitur: string;
  estimasiHari: number;
  totalHarga: number;
  tagihanAktif: number;
  termin: 'full' | 'dp';
  statusBayar: string;
}

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

export function generatePdfDocument(params: GeneratePdfParams): Promise<{ filePath: string; fileName: string; fileUrl: string }> {
  return new Promise((resolve, reject) => {
    try {
      const downloadsDir = path.join(rootDir, 'downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      const safeTitle = params.leadTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
      const fileName = `${params.jenis}_${safeTitle}_${Date.now()}.pdf`;
      const filePath = path.join(downloadsDir, fileName);
      const fileUrl = `downloads/${fileName}`;

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // --- HEADER ---
      doc.fontSize(22).fillColor('#1e3a8a').text('ANITECH DIGITAL AGENCY', 40, 40);
      doc.fontSize(9).fillColor('#64748b').text('Solusi Transformasi Digital & Pengembangan Website UMKM', 40, 68);
      doc.text('Jl. Inovasi Teknologi No. 42, Bekasi | Kontak: +62 812-3456-7890 | info@anitech.corp', 40, 80);

      // Horizontal line
      doc.moveTo(40, 96).lineTo(555, 96).strokeColor('#2563eb').lineWidth(2).stroke();

      // Document Title
      const docTitle = params.jenis.toUpperCase() === 'PROPOSAL' ? 'PROPOSAL PENAWARAN KERJASAMA' : 'INVOICE TAGIHAN RESMI';
      doc.fontSize(14).fillColor('#0f172a').text(docTitle, 40, 115, { align: 'center' });
      doc.fontSize(10).fillColor('#64748b').text(`Nomor: ${params.noDokumen} | Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 40, 132, { align: 'center' });

      // --- CLIENT INFO ---
      doc.roundedRect(40, 155, 515, 75, 6).fillColor('#f8fafc').fillAndStroke('#cbd5e1');
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text('INFORMASI KLIEN / MITRA:', 50, 165);
      doc.fontSize(10).font('Helvetica').text(`Nama Bisnis : ${params.leadTitle}`, 50, 182);
      doc.text(`Alamat      : ${params.leadAddress || '-'}`, 50, 196);
      doc.text(`No. Kontak  : ${params.leadPhone || '-'}`, 50, 210);

      // --- ITEM TABLE ---
      const tableTop = 245;
      doc.rect(40, tableTop, 515, 24).fillColor('#1e3a8a').fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
      doc.text('RINCIAN LAYANAN', 50, tableTop + 7);
      doc.text('ESTIMASI', 340, tableTop + 7);
      doc.text('HARGA (RP)', 440, tableTop + 7, { align: 'right', width: 105 });

      // Table Row
      doc.font('Helvetica').fillColor('#0f172a');
      const rowY = tableTop + 35;
      doc.fontSize(11).font('Helvetica-Bold').text(params.namaPaket, 50, rowY);
      doc.fontSize(9).font('Helvetica').fillColor('#475569').text(params.deskripsiFitur, 50, rowY + 16, { width: 280 });
      doc.fontSize(10).fillColor('#0f172a').text(`${params.estimasiHari} Hari Kerja`, 340, rowY + 5);
      doc.text(params.totalHarga.toLocaleString('id-ID'), 440, rowY + 5, { align: 'right', width: 105 });

      // Underline row
      doc.moveTo(40, rowY + 55).lineTo(555, rowY + 55).strokeColor('#e2e8f0').lineWidth(1).stroke();

      // Total summary
      const summaryY = rowY + 65;
      doc.font('Helvetica-Bold').fontSize(11).text('Total Biaya Layanan:', 300, summaryY);
      doc.text(`Rp ${params.totalHarga.toLocaleString('id-ID')}`, 440, summaryY, { align: 'right', width: 105 });

      if (params.jenis === 'invoice') {
        doc.fillColor('#2563eb').text(`Tagihan Saat Ini (${params.termin.toUpperCase()}):`, 300, summaryY + 20);
        doc.text(`Rp ${params.tagihanAktif.toLocaleString('id-ID')}`, 440, summaryY + 20, { align: 'right', width: 105 });

        doc.fillColor(params.statusBayar === 'Lunas' ? '#16a34a' : '#d97706').text(`Status Pembayaran: ${params.statusBayar}`, 300, summaryY + 40);
      }

      // --- PAYMENT & TERMS ---
      const termsY = summaryY + 70;
      doc.roundedRect(40, termsY, 515, 60, 6).fillColor('#f1f5f9').fill();
      doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('Informasi Pembayaran / Rekening:', 50, termsY + 10);
      doc.font('Helvetica').text('Bank BCA: 829-123-4567 a.n PT Anitech Solusi Digital', 50, termsY + 24);
      doc.text('Konfirmasi transfer dapat dikirimkan ke WhatsApp resmi kami dengan menyertakan nomor dokumen.', 50, termsY + 38);

      // --- SIGNATURE ---
      const signY = termsY + 80;
      doc.fontSize(10).font('Helvetica').fillColor('#0f172a').text('Hormat Kami,', 400, signY);
      doc.text('Anitech Digital Agency', 400, signY + 14);
      doc.moveTo(400, signY + 65).lineTo(520, signY + 65).strokeColor('#0f172a').lineWidth(1).stroke();
      doc.fontSize(9).font('Helvetica-Bold').text('Direktur Operasional', 400, signY + 70);

      // Footer
      doc.fontSize(8).fillColor('#94a3b8').text('Dokumen ini digenerate secara otomatis oleh sistem Lead Finder Anitech (Node.js/TypeScript Engine).', 40, 780, { align: 'center', width: 515 });

      doc.end();

      stream.on('finish', () => {
        resolve({ filePath, fileName, fileUrl });
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}
