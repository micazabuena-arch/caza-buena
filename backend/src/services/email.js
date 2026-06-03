import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import {
  buildBrandedEmail,
  bookingDetailsTable,
  getEmailLogoAttachment,
} from './emailTemplate.js';

dotenv.config();

let transporter = null;

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

function smtpPassword() {
  return String(process.env.SMTP_PASS || '').replace(/\s/g, '');
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: smtpPassword(),
      },
    });
  }
  return transporter;
}

function guestFriendlyEmailHint(err) {
  const msg = String(err?.message || '');
  if (msg.includes('Application-specific password') || msg.includes('534-5.7.9')) {
    return 'Gmail needs an App Password in SMTP_PASS (not your normal Gmail password). Create one at myaccount.google.com/apppasswords';
  }
  if (msg.includes('Invalid login') || msg.includes('535')) {
    return 'SMTP login failed. Check SMTP_USER and SMTP_PASS in backend/.env, then restart the API.';
  }
  return msg.slice(0, 200) || 'Email could not be sent.';
}

async function sendMailResult(sendFn) {
  const transport = getTransporter();
  if (!transport) {
    console.log('[Email] SMTP not configured — skipping');
    return { sent: false, reason: 'not_configured' };
  }
  try {
    await sendFn(transport);
    return { sent: true };
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
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
      Our reservations team is now reviewing your request. You can expect an update from us within
      <strong>1–2 business days</strong> once your payment has been verified.
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
    <p style="margin:0;font-size:15px;line-height:1.65;color:#214566;">
      Please bring a valid ID upon arrival. If your plans change, contact us as soon as possible.
    </p>
  `;

  const html = buildBrandedEmail({
    headline: 'Your Booking Is Confirmed',
    guestName: booking.guest_name,
    bodyHtml,
  });

  return sendMailResult((transport) =>
    transport.sendMail({
      from: process.env.EMAIL_FROM || 'Caza Buena <noreply@cazabuena.com>',
      to: booking.guest_email,
      subject: `Booking Confirmed — ${booking.reference_code}`,
      html,
      attachments: getEmailLogoAttachment(),
    })
  );
}

export async function sendContactNotification(inquiry) {
  const result = await sendMailResult((transport) =>
    transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.SMTP_USER.trim(),
      subject: `New inquiry from ${inquiry.name}`,
      text: `${inquiry.message}\n\nFrom: ${inquiry.name} (${inquiry.email})`,
    })
  );
  return result.sent;
}
