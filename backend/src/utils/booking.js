import { v4 as uuidv4 } from 'uuid';

/** Generates human-readable booking reference e.g. CB-20260525-A1B2 */
export function generateReferenceCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = uuidv4().slice(0, 4).toUpperCase();
  return `CB-${date}-${suffix}`;
}

export function calculateNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/** Check if room is available for date range (excludes given booking id when updating) */
export async function isRoomAvailable(pool, roomId, checkIn, checkOut, excludeBookingId = null) {
  // Blocked dates by admin
  const [blocks] = await pool.query(
    `SELECT id FROM room_unavailability
     WHERE room_id = ? AND start_date < ? AND end_date > ?`,
    [roomId, checkOut, checkIn]
  );
  if (blocks.length > 0) return false;

  // Overlapping confirmed / active bookings
  let query = `
    SELECT id FROM bookings
    WHERE room_id = ?
      AND status IN ('pending', 'awaiting_payment', 'payment_submitted', 'confirmed')
      AND check_in < ? AND check_out > ?
  `;
  const params = [roomId, checkOut, checkIn];
  if (excludeBookingId) {
    query += ' AND id != ?';
    params.push(excludeBookingId);
  }
  const [bookings] = await pool.query(query, params);
  return bookings.length === 0;
}

/** Single-night stay starting on date (check-in that day, check-out next day) */
export async function isRoomAvailableForNight(pool, roomId, dateStr) {
  const start = new Date(`${dateStr}T12:00:00`);
  start.setUTCDate(start.getUTCDate() + 1);
  const checkOut = start.toISOString().slice(0, 10);
  return isRoomAvailable(pool, roomId, dateStr, checkOut);
}

/** Min price & availability across active rooms that fit guestCount for one night */
export async function getDayRateSummary(pool, dateStr, guestCount = 1) {
  const guests = Math.max(1, parseInt(guestCount, 10) || 1);
  const { getNightlyRate } = await import('./pricing.js');
  const [rooms] = await pool.query(
    `SELECT id FROM rooms WHERE is_active = 1
     AND COALESCE(min_guests, 1) <= ? AND COALESCE(max_guests, capacity) >= ?`,
    [guests, guests]
  );
  const prices = [];
  for (const room of rooms) {
    const ok = await isRoomAvailableForNight(pool, room.id, dateStr);
    if (ok) {
      const rate = await getNightlyRate(pool, room.id, dateStr);
      if (rate != null) prices.push(rate);
    }
  }
  if (prices.length === 0) return { available: false, min_price: null, rate_type: null };
  const { getRateTypeLabel, getHolidayRateForDate } = await import('./pricing.js');
  let rateType = getRateTypeLabel(dateStr);
  for (const room of rooms) {
    const h = await getHolidayRateForDate(pool, room.id, dateStr);
    if (h) {
      rateType = 'holiday';
      break;
    }
  }
  return { available: true, min_price: Math.min(...prices), rate_type: rateType };
}

export async function applyDiscount(pool, code, nights, subtotal) {
  if (!code) return { amount: 0, code: null };

  const [rows] = await pool.query(
    `SELECT * FROM discounts
     WHERE code = ? AND is_active = 1
       AND (valid_from IS NULL OR valid_from <= CURDATE())
       AND (valid_until IS NULL OR valid_until >= CURDATE())
       AND (max_uses IS NULL OR used_count < max_uses)`,
    [code.toUpperCase()]
  );
  if (rows.length === 0) return { amount: 0, code: null, error: 'Invalid discount code' };

  const discount = rows[0];
  if (nights < discount.min_nights) {
    return { amount: 0, code: null, error: `Minimum ${discount.min_nights} night(s) required` };
  }

  let amount = 0;
  if (discount.type === 'percentage') {
    amount = (subtotal * discount.value) / 100;
  } else {
    amount = Math.min(discount.value, subtotal);
  }
  return { amount, code: discount.code, discountId: discount.id };
}
