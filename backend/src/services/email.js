import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendBookingAcknowledgment(booking, room) {
  const transport = getTransporter();
  if (!transport) {
    console.log('[Email] SMTP not configured — skipping acknowledgment');
    return false;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  await transport.sendMail({
    from: process.env.EMAIL_FROM || 'Caza Buena <noreply@cazabuena.com>',
    to: booking.guest_email,
    subject: `Booking Request Received — ${booking.reference_code}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #0D4F6C;">
        <h1 style="color: #1E6B8C;">Caza Buena</h1>
        <p>Hi ${booking.guest_name},</p>
        <p>Thank you for your booking request. We have received your reservation details.</p>
        <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td><strong>Reference</strong></td><td>${booking.reference_code}</td></tr>
          <tr><td><strong>Room</strong></td><td>${room.name}</td></tr>
          <tr><td><strong>Check-in</strong></td><td>${booking.check_in}</td></tr>
          <tr><td><strong>Check-out</strong></td><td>${booking.check_out}</td></tr>
          <tr><td><strong>Booking total</strong></td><td>₱${Number(booking.total_amount).toLocaleString()}</td></tr>
          <tr><td><strong>Amount to pay now</strong></td><td>₱${Number(booking.amount_to_pay ?? booking.total_amount).toLocaleString()}</td></tr>
          <tr><td><strong>Status</strong></td><td>Awaiting payment verification</td></tr>
        </table>
        <p>Please complete your QR/bank transfer payment and upload proof here:</p>
        <p><a href="${frontendUrl}/booking/confirm/${booking.reference_code}" style="background:#1E6B8C;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;">Upload Payment Proof</a></p>
        <p style="color:#666;font-size:14px;">Your home after the sea 🌊</p>
      </div>
    `,
  });
  return true;
}

export async function sendBookingConfirmation(booking, room) {
  const transport = getTransporter();
  if (!transport) return false;

  await transport.sendMail({
    from: process.env.EMAIL_FROM || 'Caza Buena <noreply@cazabuena.com>',
    to: booking.guest_email,
    subject: `Booking Confirmed — ${booking.reference_code}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #0D4F6C;">
        <h1 style="color: #1E6B8C;">You're confirmed! ✨</h1>
        <p>Hi ${booking.guest_name},</p>
        <p>Your stay at Caza Buena is confirmed. We can't wait to welcome you.</p>
        <p><strong>${room.name}</strong> · ${booking.check_in} to ${booking.check_out}</p>
        <p>Check-in: 1:00 PM · Check-out: 11:00 AM</p>
        <p>📍 Sitio Inansuana, Brgy. Lucap, Alaminos, Pangasinan</p>
        <p>Questions? Call +63 917 829 0292 or reply to this email.</p>
      </div>
    `,
  });
  return true;
}

export async function sendContactNotification(inquiry) {
  const transport = getTransporter();
  if (!transport) return false;

  const adminEmail = process.env.SMTP_USER;
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `New inquiry from ${inquiry.name}`,
    text: `${inquiry.message}\n\nFrom: ${inquiry.name} (${inquiry.email})`,
  });
  return true;
}
