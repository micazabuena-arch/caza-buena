import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const EMAIL_LOGO_CID = 'cazaBuenaLogo@email';

const RESORT_ADDRESS =
  process.env.RESORT_ADDRESS || 'Sitio Inansuana, Brgy. Lucap, Alaminos, Pangasinan';
const RESORT_PHONE = process.env.RESORT_PHONE || '(0915) 711 8212';

const BRAND = {
  primary: '#498bc3',
  bodyBg: '#ffffff',
  pageBg: '#eef4fa',
  text: '#214566',
  muted: '#336894',
  border: '#dceaf5',
};

export function getEmailLogoAttachment() {
  const customUrl = process.env.EMAIL_LOGO_URL?.trim();
  if (customUrl) return [];

  const logoPath = path.resolve(__dirname, '../../assets/email-logo.png');
  if (!existsSync(logoPath)) return [];

  return [
    {
      filename: 'logo.png',
      path: logoPath,
      cid: EMAIL_LOGO_CID,
    },
  ];
}

function emailLogoHtml() {
  if (process.env.EMAIL_LOGO_URL?.trim()) {
    const url = process.env.EMAIL_LOGO_URL.trim();
    return `<img src="${url}" alt="Caza Buena" width="120" style="display:block;width:120px;height:auto;border:0;" />`;
  }
  return `<img src="cid:${EMAIL_LOGO_CID}" alt="Caza Buena" width="120" style="display:block;width:120px;height:auto;border:0;" />`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emailFooter() {
  return `
    <p style="margin:28px 0 8px;font-size:15px;line-height:1.5;color:${BRAND.text};font-family:Arial,sans-serif;">
      Sincerely,<br /><strong>Caza Buena</strong>
    </p>
    <p style="margin:0 0 6px;font-size:14px;line-height:1.5;color:${BRAND.muted};font-family:Arial,sans-serif;">
      &#128205; ${escapeHtml(RESORT_ADDRESS)}
    </p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:${BRAND.muted};font-family:Arial,sans-serif;">
      &#128222; ${escapeHtml(RESORT_PHONE)}
    </p>
  `;
}

export function buildBrandedEmail({ headline, guestName, bodyHtml }) {
  const name = escapeHtml(guestName || 'Guest');

  return `
<div style="margin:0;padding:20px 12px;background:${BRAND.pageBg};font-family:Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:${BRAND.bodyBg};border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};">
    <tr>
      <td style="background:${BRAND.primary};padding:22px 28px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom:14px;background:#fff;border-radius:8px;padding:8px 12px;width:120px;">
              ${emailLogoHtml()}
            </td>
          </tr>
          <tr>
            <td style="font-size:18px;font-weight:bold;color:#fff;line-height:1.3;padding-top:14px;">
              ${escapeHtml(headline)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;color:${BRAND.text};font-size:15px;line-height:1.6;">
        <p style="margin:0 0 18px;">Dear <strong>${name}</strong>,</p>
        ${bodyHtml}
        ${emailFooter()}
      </td>
    </tr>
  </table>
</div>
  `.trim();
}

export function bookingDetailsTable(booking, room) {
  const rows = [
    ['Reference', booking.reference_code],
    ['Room', room.name],
    ['Check-in', booking.check_in],
    ['Check-out', booking.check_out],
    ['Nights', booking.nights],
    ['Booking total', `₱${Number(booking.total_amount).toLocaleString()}`],
    [
      'Amount submitted',
      `₱${Number(booking.amount_to_pay ?? booking.total_amount).toLocaleString()}`,
    ],
  ].filter(([, val]) => val != null && val !== '');

  const trs = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.muted};">${escapeHtml(label)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${BRAND.border};font-size:14px;font-weight:bold;color:${BRAND.text};">${escapeHtml(value)}</td>
      </tr>
    `
    )
    .join('');

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;border:1px solid ${BRAND.border};border-radius:6px;">${trs}</table>`;
}
