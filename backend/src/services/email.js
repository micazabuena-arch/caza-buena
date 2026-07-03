import nodemailer from 'nodemailer';
import dns from 'dns';
import { promisify } from 'util';
import dotenv from 'dotenv';
import {
  buildBrandedEmail,
  bookingDetailsTable,
  getEmailLogoAttachment,
  escapeHtml,
} from './emailTemplate.js';
import { soaAttachmentFilename } from '../utils/bookingSoa.js';
import { formatBookingRoomsPlainLabel } from './emailTemplate.js';

dotenv.config();

const dnsLookup = promisify(dns.lookup);

let transporter = null;
let transporterInit = null;

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

function smtpPassword() {
  return String(process.env.SMTP_PASS || '').replace(/\s/g, '');
}

function smtpHostName() {
  return process.env.SMTP_HOST || 'smtp.gmail.com';
}

/** Nodemailer custom lookup — always use IPv4 (Render cannot reach Gmail over IPv6). */
function ipv4Lookup(hostname, _options, callback) {
  dns.lookup(hostname, { family: 4 }, callback);
}

async function resolveSmtpIpv4Host() {
  const explicit = process.env.SMTP_HOST_IPV4?.trim();
  if (explicit) return explicit;

  const hostname = smtpHostName();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return hostname;

  const { address } = await dnsLookup(hostname, { family: 4 });
  return address;
}

async function buildTransporter() {
  const hostname = smtpHostName();
  const host = await resolveSmtpIpv4Host();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465;

  console.log(`[Email] SMTP connect ${host}:${port} (TLS servername ${hostname})`);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 25000,
    tls: { servername: hostname },
    lookup: ipv4Lookup,
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: smtpPassword(),
    },
  });
}

async function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!transporterInit) {
    transporterInit = buildTransporter()
      .then((t) => {
        transporter = t;
        return t;
      })
      .catch((err) => {
        transporterInit = null;
        throw err;
      });
  }
  return transporterInit;
}

function guestFriendlyEmailHint(err) {
  const msg = String(err?.message || '');
  if (msg.includes('Application-specific password') || msg.includes('534-5.7.9')) {
    return 'Gmail needs an App Password in SMTP_PASS (not your normal Gmail password). Create one at myaccount.google.com/apppasswords';
  }
  if (msg.includes('Invalid login') || msg.includes('535')) {
    return 'SMTP login failed. Check SMTP_USER and SMTP_PASS on Render, then redeploy.';
  }
  if (msg.includes('ENETUNREACH') || msg.includes('ETIMEDOUT') || msg.includes('Connection timeout')) {
    return 'SMTP connection failed. On Render set SMTP_HOST=smtp.gmail.com and redeploy, or set SMTP_HOST_IPV4 to Gmail’s IPv4 address.';
  }
  return msg.slice(0, 200) || 'Email could not be sent.';
}

async function sendMailResult(sendFn) {
  let transport;
  try {
    transport = await getTransporter();
  } catch (err) {
    console.error('[Email] SMTP setup failed:', err.message);
    return { sent: false, reason: 'setup_failed', hint: guestFriendlyEmailHint(err) };
  }

  if (!transport) {
    console.log('[Email] SMTP not configured — skipping');
    return { sent: false, reason: 'not_configured' };
  }

  try {
    await sendFn(transport);
    return { sent: true };
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    transporter = null;
    transporterInit = null;
    return { sent: false, reason: 'send_failed', hint: guestFriendlyEmailHint(err) };
  }
}

/** Sent after guest uploads payment proof — booking request received */
export async function sendPaymentProofReceivedEmail(booking, room) {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#214566;">
      Thank you for choosing <strong>Caza Buena</strong>. We have received your booking request
      and payment details for reference <strong>${booking.reference_code}</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#214566;">
      Our reservations team is now reviewing your request. You can expect an update from us
      <strong>within 24 hours</strong> once your payment has been verified.
    </p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#214566;">
      Summary of your request:
    </p>
    ${bookingDetailsTable(booking, room)}
    <p style="margin:0;font-size:15px;line-height:1.65;color:#214566;">
      If you have questions in the meantime, reply to this email or contact us using the details below.
      We look forward to welcoming you.
    </p>
  `;

  const html = buildBrandedEmail({
    headline: "We've Received Your Booking Request",
    guestName: booking.guest_name,
    bodyHtml,
  });

  return sendMailResult((transport) =>
    transport.sendMail({
      from: process.env.EMAIL_FROM || 'Caza Buena <noreply@cazabuena.com>',
      to: booking.guest_email,
      subject: `Booking Request Received — ${booking.reference_code}`,
      html,
      attachments: getEmailLogoAttachment(),
    })
  );
}

/** Sent when admin rejects a booking that included payment proof */
export async function sendBookingRejectedEmail(booking, room, rejectionReason) {
  const reasonBlock = rejectionReason?.trim()
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#214566;">
        <strong>Reason:</strong> ${escapeHtml(rejectionReason.trim())}
      </p>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#214566;">
      Thank you for your interest in staying at <strong>Caza Buena</strong>. After reviewing your
      booking request <strong>${escapeHtml(booking.reference_code)}</strong> and the payment proof
      you submitted, we are unable to confirm this reservation at this time.
    </p>
    ${reasonBlock}
    ${bookingDetailsTable(booking, room)}
    <p style="margin:0;font-size:15px;line-height:1.65;color:#214566;">
      If you believe this was a mistake or you would like to book different dates, please reply to
      this email or contact us. For payment concerns, our team will assist you with next steps.
    </p>
  `;

  const html = buildBrandedEmail({
    headline: 'Update on Your Booking Request',
    guestName: booking.guest_name,
    bodyHtml,
  });

  return sendMailResult((transport) =>
    transport.sendMail({
      from: process.env.EMAIL_FROM || 'Caza Buena <noreply@cazabuena.com>',
      to: booking.guest_email,
      subject: `Booking Not Confirmed — ${booking.reference_code}`,
      html,
      attachments: getEmailLogoAttachment(),
    })
  );
}

export async function sendBookingConfirmation(booking, room) {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#214566;">
      Great news — your stay at <strong>Caza Buena</strong> is <strong>confirmed</strong>.
      We are excited to welcome you.
    </p>
    ${bookingDetailsTable(booking, room)}
    <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#214566;">
      <strong>Check-in:</strong> 1:00 PM &nbsp;·&nbsp; <strong>Check-out:</strong> 11:00 AM
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#214566;">
      Your booking confirmation/statement of account (SOA) is attached to this email for your reference.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#214566;">
      Please bring a valid ID upon arrival. If your plans change, contact us as soon as possible.
    </p>
  `;

  const html = buildBrandedEmail({
    headline: 'Your Booking Is Confirmed',
    guestName: booking.guest_name,
    bodyHtml,
  });

  let soaPdf = null;
  try {
    const { generateBookingSoaPdf } = await import('../utils/bookingSoaPdf.js');
    soaPdf = await generateBookingSoaPdf(
      {
        ...booking,
        room_name: formatBookingRoomsPlainLabel(booking, room),
      },
      { docType: 'confirmation' }
    );
  } catch (err) {
    console.warn('[Email] SOA PDF generation failed:', err.message);
  }

  const attachments = [...getEmailLogoAttachment()];
  if (soaPdf?.length) {
    attachments.push({
      filename: soaAttachmentFilename(booking.reference_code),
      content: soaPdf,
      contentType: 'application/pdf',
    });
  }

  return sendMailResult((transport) =>
    transport.sendMail({
      from: process.env.EMAIL_FROM || 'Caza Buena <noreply@cazabuena.com>',
      to: booking.guest_email,
      subject: `Booking Confirmed — ${booking.reference_code}`,
      html,
      attachments,
    })
  );
}

export async function sendContactNotification(inquiry) {
  const notifyTo = process.env.CONTACT_NOTIFY_EMAIL?.trim() || process.env.SMTP_USER?.trim();
  if (!notifyTo) {
    console.log('[Email] CONTACT_NOTIFY_EMAIL / SMTP_USER not set — skipping contact notification');
    return { sent: false, reason: 'not_configured' };
  }

  const from =
    process.env.EMAIL_FROM?.trim() ||
    (process.env.SMTP_USER?.trim() ? `Caza Buena <${process.env.SMTP_USER.trim()}>` : 'Caza Buena');

  return sendMailResult((transport) =>
    transport.sendMail({
      from,
      to: notifyTo,
      replyTo: inquiry.email,
      subject: `New inquiry from ${inquiry.name}`,
      text: `${inquiry.message}\n\nFrom: ${inquiry.name} (${inquiry.email})`,
    })
  );
}
