import { applyDiscount } from './booking.js';

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

/** Parse and cap a manual admin discount against room stay subtotal. */
export function clampManualDiscount(staySubtotal, amountRaw, noteRaw) {
  const subtotal = Number(staySubtotal) || 0;
  const trimmed =
    amountRaw === undefined || amountRaw === null ? '' : String(amountRaw).trim();

  if (trimmed === '') {
    return { amount: 0, note: null, error: null };
  }

  const raw = parseFloat(trimmed);
  if (!Number.isFinite(raw) || raw < 0) {
    return { amount: 0, note: null, error: 'Discount amount must be zero or greater' };
  }
  if (raw <= 0) {
    return { amount: 0, note: null, error: null };
  }
  if (raw > subtotal) {
    return {
      amount: 0,
      note: null,
      error: `Discount cannot exceed room stay total (₱${Math.round(subtotal).toLocaleString()})`,
    };
  }

  const note = String(noteRaw || '')
    .trim()
    .slice(0, 255) || null;

  return { amount: roundMoney(raw), note, error: null };
}

/**
 * Resolve discount for admin create/update.
 * Promo codes on existing bookings take precedence over manual fields.
 */
export async function resolveAdminBookingDiscount(
  pool,
  { staySubtotal, nights, discount_code, admin_discount_amount, admin_discount_note }
) {
  if (discount_code) {
    const { amount, error } = await applyDiscount(pool, discount_code, nights, staySubtotal);
    if (error) return { amount: 0, code: discount_code, note: null, error };
    return { amount: amount || 0, code: discount_code, note: null, error: null };
  }

  const manual = clampManualDiscount(staySubtotal, admin_discount_amount, admin_discount_note);
  if (manual.error) {
    return { amount: 0, code: null, note: null, error: manual.error };
  }

  return {
    amount: manual.amount,
    code: null,
    note: manual.note,
    error: null,
  };
}

/** Discount for rebook quotes — promo code or stored manual amount. */
export async function resolveStoredBookingDiscount(pool, booking, nights, staySubtotal) {
  if (booking.discount_code) {
    const { amount, error } = await applyDiscount(
      pool,
      booking.discount_code,
      nights,
      staySubtotal
    );
    return { amount: amount || 0, error: error || null };
  }

  const stored = Number(booking.discount_amount) || 0;
  const subtotal = Number(staySubtotal) || 0;
  return { amount: Math.min(stored, subtotal), error: null };
}
