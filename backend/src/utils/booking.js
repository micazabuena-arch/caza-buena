import { v4 as uuidv4 } from 'uuid';
import { getRateTypeLabel, resolveNightlyPrice } from './pricing.js';

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

/** Local YYYY-MM-DD for the server clock (used for ante-date / recording stays). */
export function todayYmd(referenceDate = new Date()) {
  const y = referenceDate.getFullYear();
  const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const d = String(referenceDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Admin ante-date: check-in is before today.
 * Past stays may be recorded for SOA even when the room calendar shows a conflict.
 */
export function isAnteDateCheckIn(checkIn, referenceDate = new Date()) {
  if (!checkIn) return false;
  return String(checkIn).slice(0, 10) < todayYmd(referenceDate);
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
  if (bookings.length > 0) return false;

  // Additional rooms on multi-room bookings
  let extraQuery = `
    SELECT br.id FROM booking_rooms br
    INNER JOIN bookings b ON b.id = br.booking_id
    WHERE br.room_id = ?
      AND b.status IN ('pending', 'awaiting_payment', 'payment_submitted', 'confirmed')
      AND b.check_in < ? AND b.check_out > ?
  `;
  const extraParams = [roomId, checkOut, checkIn];
  if (excludeBookingId) {
    extraQuery += ' AND b.id != ?';
    extraParams.push(excludeBookingId);
  }
  const [extraBookings] = await pool.query(extraQuery, extraParams);
  return extraBookings.length === 0;
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

function nextCalendarDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nightOverlapsRange(startDate, endDate, rangeStart, rangeEndExclusive) {
  return startDate < rangeEndExclusive && endDate > rangeStart;
}

/** Batch-fetch calendar rates (avoids hundreds of DB round-trips on remote MySQL) */
export async function getRateCalendarDays(pool, from, to, guestCount = 1) {
  const guests = Math.max(1, parseInt(guestCount, 10) || 1);
  const rangeEndExclusive = nextCalendarDay(to);

  const [rooms] = await pool.query(
    `SELECT id, price_per_night, price_weekend FROM rooms WHERE is_active = 1
     AND COALESCE(min_guests, 1) <= ? AND COALESCE(max_guests, capacity) >= ?`,
    [guests, guests]
  );

  const unavailableDay = { available: false, min_price: null, rate_type: null };
  const days = {};
  const cursor = new Date(`${from}T12:00:00`);
  const endDate = new Date(`${to}T12:00:00`);
  while (cursor <= endDate) {
    days[cursor.toISOString().slice(0, 10)] = { ...unavailableDay };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (rooms.length === 0) return days;

  const roomIds = rooms.map((r) => r.id);
  const placeholders = roomIds.map(() => '?').join(',');

  const [blocks, bookings, holidays] = await Promise.all([
    pool.query(
      `SELECT room_id, start_date, end_date FROM room_unavailability
       WHERE room_id IN (${placeholders}) AND start_date < ? AND end_date > ?`,
      [...roomIds, rangeEndExclusive, from]
    ),
    pool.query(
      `SELECT room_id, check_in, check_out FROM bookings
       WHERE room_id IN (${placeholders})
         AND status IN ('pending', 'awaiting_payment', 'payment_submitted', 'confirmed')
         AND check_in < ? AND check_out > ?
       UNION ALL
       SELECT br.room_id, b.check_in, b.check_out FROM booking_rooms br
       INNER JOIN bookings b ON b.id = br.booking_id
       WHERE br.room_id IN (${placeholders})
         AND b.status IN ('pending', 'awaiting_payment', 'payment_submitted', 'confirmed')
         AND b.check_in < ? AND b.check_out > ?`,
      [...roomIds, rangeEndExclusive, from, ...roomIds, rangeEndExclusive, from]
    ),
    pool.query(
      `SELECT room_id, start_date, end_date, price_per_night FROM room_holiday_rates
       WHERE room_id IN (${placeholders}) AND start_date <= ? AND end_date >= ?`,
      [...roomIds, to, from]
    ),
  ]);

  const blockRows = blocks[0];
  const bookingRows = bookings[0];
  const holidayRows = holidays[0];

  for (const dateStr of Object.keys(days)) {
    const checkOut = nextCalendarDay(dateStr);
    const prices = [];
    let hasHoliday = false;

    for (const room of rooms) {
      const blocked = blockRows.some(
        (b) =>
          b.room_id === room.id &&
          nightOverlapsRange(b.start_date, b.end_date, dateStr, checkOut)
      );
      if (blocked) continue;

      const booked = bookingRows.some(
        (b) =>
          b.room_id === room.id &&
          nightOverlapsRange(b.check_in, b.check_out, dateStr, checkOut)
      );
      if (booked) continue;

      const holiday = holidayRows.find(
        (h) => h.room_id === room.id && dateStr >= h.start_date && dateStr <= h.end_date
      );
      if (holiday) hasHoliday = true;
      prices.push(resolveNightlyPrice(room, dateStr, holiday));
    }

    if (prices.length > 0) {
      days[dateStr] = {
        available: true,
        min_price: Math.min(...prices),
        rate_type: hasHoliday ? 'holiday' : getRateTypeLabel(dateStr),
      };
    }
  }

  return days;
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
