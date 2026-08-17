/**
 * Stay payment ledger — each DP / partial / full is its own row so SOA and
 * admin views keep the full series instead of overwriting amount_to_pay.
 */

export const PAYMENT_TYPES = ['deposit', 'partial', 'full', 'custom'];

const TYPE_LABELS = {
  deposit: 'Down payment',
  partial: 'Partial payment',
  full: 'Full payment',
  custom: 'Custom payment',
};

export function paymentTypeLabel(type) {
  return TYPE_LABELS[type] || String(type || 'Payment').replace(/_/g, ' ');
}

export function normalizePaymentType(type) {
  const value = String(type || 'custom').toLowerCase();
  return PAYMENT_TYPES.includes(value) ? value : 'custom';
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export async function listBookingPayments(pool, bookingId) {
  const [rows] = await pool.query(
    `SELECT id, booking_id, payment_type, amount, note, paid_at, created_at
     FROM booking_payments
     WHERE booking_id = ?
     ORDER BY paid_at ASC, id ASC`,
    [bookingId]
  );
  return rows || [];
}

export function sumPaymentAmounts(payments) {
  return roundMoney(
    (payments || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  );
}

/** Keep bookings.amount_to_pay aligned with the ledger total (legacy field). */
export async function syncBookingAmountToPay(pool, bookingId) {
  const payments = await listBookingPayments(pool, bookingId);
  const totalPaid = sumPaymentAmounts(payments);
  // bookings.payment_option only allows deposit|full|custom — map partial → custom.
  const lastType = payments.length
    ? normalizePaymentType(payments[payments.length - 1].payment_type)
    : null;
  const optionForBooking =
    lastType === 'deposit' || lastType === 'full' || lastType === 'custom'
      ? lastType
      : lastType
        ? 'custom'
        : null;

  if (optionForBooking) {
    await pool.query(
      'UPDATE bookings SET amount_to_pay = ?, payment_option = ? WHERE id = ?',
      [totalPaid, optionForBooking, bookingId]
    );
  } else {
    await pool.query('UPDATE bookings SET amount_to_pay = ? WHERE id = ?', [
      totalPaid,
      bookingId,
    ]);
  }

  return { payments, totalPaid };
}

export async function attachBookingPayments(pool, booking) {
  if (!booking?.id) return booking;
  try {
    const payments = await listBookingPayments(pool, booking.id);
    booking.payments = payments;
  } catch (err) {
    // Table may be missing before migrate — don't break booking detail.
    console.warn('[booking_payments] unavailable:', err.message);
    booking.payments = Array.isArray(booking.payments) ? booking.payments : [];
  }
  return booking;
}

/**
 * Record the first payment when creating a confirmed/manual booking that
 * already has an amount_to_pay (skip if ledger already has rows).
 */
export async function seedBookingPaymentIfEmpty(pool, bookingId, {
  payment_type = 'custom',
  amount,
  note = null,
  paid_at = null,
} = {}) {
  const paid = roundMoney(amount);
  if (!bookingId || paid <= 0) return null;

  const existing = await listBookingPayments(pool, bookingId);
  if (existing.length > 0) return existing[0];

  return insertBookingPayment(pool, bookingId, {
    payment_type,
    amount: paid,
    note,
    paid_at,
  });
}

export async function insertBookingPayment(pool, bookingId, {
  payment_type = 'custom',
  amount,
  note = null,
  paid_at = null,
} = {}) {
  const paid = roundMoney(amount);
  if (paid <= 0) {
    return { error: 'Payment amount must be greater than zero' };
  }

  const type = normalizePaymentType(payment_type);
  const paidAt = paid_at ? new Date(paid_at) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return { error: 'Invalid payment date' };
  }

  const [result] = await pool.query(
    `INSERT INTO booking_payments (booking_id, payment_type, amount, note, paid_at)
     VALUES (?, ?, ?, ?, ?)`,
    [bookingId, type, paid, note?.trim() || null, paidAt]
  );

  await syncBookingAmountToPay(pool, bookingId);

  const [rows] = await pool.query('SELECT * FROM booking_payments WHERE id = ?', [
    result.insertId,
  ]);
  return rows[0];
}

export async function updateBookingPayment(pool, paymentId, {
  payment_type,
  amount,
  note,
  paid_at,
} = {}) {
  const [existingRows] = await pool.query(
    'SELECT * FROM booking_payments WHERE id = ?',
    [paymentId]
  );
  if (!existingRows.length) return { error: 'Payment not found', status: 404 };

  const existing = existingRows[0];
  const paid = amount != null ? roundMoney(amount) : roundMoney(existing.amount);
  if (paid <= 0) return { error: 'Payment amount must be greater than zero' };

  const type =
    payment_type != null
      ? normalizePaymentType(payment_type)
      : normalizePaymentType(existing.payment_type);
  const paidAt =
    paid_at != null ? new Date(paid_at) : existing.paid_at ? new Date(existing.paid_at) : new Date();
  if (Number.isNaN(paidAt.getTime())) return { error: 'Invalid payment date' };

  const nextNote = note !== undefined ? (note?.trim() || null) : existing.note;

  await pool.query(
    `UPDATE booking_payments
     SET payment_type = ?, amount = ?, note = ?, paid_at = ?
     WHERE id = ?`,
    [type, paid, nextNote, paidAt, paymentId]
  );

  await syncBookingAmountToPay(pool, existing.booking_id);

  const [rows] = await pool.query('SELECT * FROM booking_payments WHERE id = ?', [paymentId]);
  return rows[0];
}

export async function deleteBookingPayment(pool, paymentId) {
  const [existingRows] = await pool.query(
    'SELECT * FROM booking_payments WHERE id = ?',
    [paymentId]
  );
  if (!existingRows.length) return { error: 'Payment not found', status: 404 };

  const existing = existingRows[0];
  await pool.query('DELETE FROM booking_payments WHERE id = ?', [paymentId]);
  await syncBookingAmountToPay(pool, existing.booking_id);
  return { booking_id: existing.booking_id };
}
