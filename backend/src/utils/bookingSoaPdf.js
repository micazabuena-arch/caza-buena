import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import {
  buildBookingSoaLineItems,
  formatSoaAmount,
  getBookingPaymentSummary,
} from './bookingSoa.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRAND = '#498bc3';
const RESORT = {
  email: process.env.RESORT_EMAIL || 'mi.caza.buena@gmail.com',
  phone: process.env.RESORT_PHONE || '0947 191 8080',
  address: process.env.RESORT_ADDRESS || 'Sitio Inansuana, Brgy. Lucap, Alaminos, Pangasinan',
};

function logoPath() {
  const candidates = [
    path.resolve(__dirname, '../../assets/email-logo.png'),
    path.resolve(__dirname, '../../../frontend/public/logo.png'),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

function drawTableRow(doc, y, label, amount, { bold = false, width, colAmount = 120 } = {}) {
  const colLabel = width - colAmount;
  const rowH = 22;
  doc.rect(doc.page.margins.left, y, colLabel, rowH).stroke();
  doc.rect(doc.page.margins.left + colLabel, y, colAmount, rowH).stroke();
  doc
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(10)
    .fillColor('#000000')
    .text(label, doc.page.margins.left + 8, y + 6, { width: colLabel - 16 })
    .text(amount, doc.page.margins.left + colLabel + 8, y + 6, {
      width: colAmount - 16,
      align: 'right',
    });
  return y + rowH;
}

/**
 * Generate booking confirmation / SOA PDF (matches admin print layout).
 * @returns {Promise<Buffer|null>}
 */
export function generateBookingSoaPdf(booking) {
  if (!booking) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 47 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      let y = doc.page.margins.top;

      const logo = logoPath();
      if (logo) {
        doc.image(logo, doc.page.margins.left, y, { height: 52 });
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(BRAND)
        .text('CAZA BUENA', doc.page.margins.left + (logo ? 62 : 0), y + 4);

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(BRAND)
        .text('Est. 2024', doc.page.margins.left + (logo ? 62 : 0), y + 28);

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(BRAND)
        .text(RESORT.email, doc.page.margins.left, y, { width: pageWidth, align: 'right' })
        .text(RESORT.phone, doc.page.margins.left, y + 11, { width: pageWidth, align: 'right' })
        .text(RESORT.address, doc.page.margins.left, y + 22, { width: pageWidth, align: 'right' });

      y += 58;
      doc
        .moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.margins.left + pageWidth, y)
        .lineWidth(2)
        .strokeColor(BRAND)
        .stroke();

      y += 18;
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#000000')
        .text('BOOKING CONFIRMATION/ STATEMENT OF ACCOUNT', doc.page.margins.left, y, {
          width: pageWidth,
          align: 'center',
        });

      y += 28;
      const nights = booking.nights ?? 0;
      const nightsLabel = `${nights} NIGHT${nights === 1 ? '' : 'S'}`;
      const guestLines = [
        `Guest: ${booking.guest_name || '—'}`,
        `E-mail: ${booking.guest_email || '—'}`,
        `Phone: ${booking.guest_phone || '—'}`,
        `Room: ${booking.room_name || '—'}`,
        `Stay Dates: ${booking.check_in} - ${booking.check_out} ( ${nightsLabel} )`,
      ];

      doc.font('Helvetica').fontSize(10).fillColor('#000000');
      guestLines.forEach((line) => {
        doc.text(line, doc.page.margins.left, y, { width: pageWidth });
        y += 14;
      });

      y += 8;
      const lineItems = buildBookingSoaLineItems(booking);
      const payment = getBookingPaymentSummary(booking);

      lineItems.forEach((item) => {
        y = drawTableRow(doc, y, item.label, formatSoaAmount(item.amount), { width: pageWidth });
      });

      y = drawTableRow(doc, y, 'Total', formatSoaAmount(payment.total), {
        bold: true,
        width: pageWidth,
      });
      y = drawTableRow(doc, y, payment.upfrontLabel, formatSoaAmount(payment.payNow), {
        bold: true,
        width: pageWidth,
      });
      y = drawTableRow(doc, y, 'Balance Due', formatSoaAmount(payment.balance), {
        bold: true,
        width: pageWidth,
      });

      y += 16;
      doc.font('Helvetica-Bold').fontSize(9).text('Payment information:', doc.page.margins.left, y);
      y += 14;
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(
          'Please pay via the preferred method, we accept cash, e-wallet, bank transfer, QR payments, debit card and credit card.',
          doc.page.margins.left,
          y,
          { width: pageWidth }
        );
      y += 28;
      doc
        .font('Helvetica-Oblique')
        .fontSize(9)
        .text(
          '*Note: We accept cash, bank transfers, and e-wallets for the Hundred Islands tour and seafood bilao. Payments made via credit or debit card are subject to a 3% processing fee*',
          doc.page.margins.left,
          y,
          { width: pageWidth }
        );

      y += 48;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Cashier signature', doc.page.margins.left, y)
        .text('Guest signature', doc.page.margins.left, y, { width: pageWidth, align: 'right' });

      y += 40;
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Thank you for Choosing Caza Buena!', doc.page.margins.left, y, {
          width: pageWidth,
          align: 'center',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
