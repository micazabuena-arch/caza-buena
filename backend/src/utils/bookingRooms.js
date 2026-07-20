import { calculateNights, isRoomAvailable } from './booking.js';
import { calculateStayTotal } from './pricing.js';

/** Normalize API body to room line objects. */
export function normalizeRoomLines(body) {
  if (Array.isArray(body.room_lines) && body.room_lines.length > 0) {
    return body.room_lines.map((line, index) => ({
      room_id: parseInt(line.room_id, 10),
      adults: parseInt(line.adults, 10) || 1,
      children_under6: parseInt(line.children_under6, 10) || 0,
      children_7_12: parseInt(line.children_7_12, 10) || 0,
      sort_order: index,
    }));
  }

  const adults =
    body.adults != null
      ? parseInt(body.adults, 10) || 1
      : parseInt(body.guest_count, 10) || 1;
  const childrenUnder6 = parseInt(body.children_under6, 10) || 0;
  const children712 = parseInt(body.children_7_12, 10) || 0;

  return [
    {
      room_id: parseInt(body.room_id, 10),
      adults,
      children_under6: childrenUnder6,
      children_7_12: children712,
      sort_order: 0,
    },
  ];
}

/**
 * Validate availability, occupancy, and pricing for each room line.
 * @param {object} [options]
 * @param {boolean} [options.skipAvailabilityCheck] - Skip calendar conflicts (admin ante-date recording).
 * @param {boolean} [options.allowInactiveRooms] - Allow booking rooms marked inactive (admin only).
 */
export async function validateAndPriceRoomLines(pool, checkIn, checkOut, rawLines, options = {}) {
  const { skipAvailabilityCheck = false, allowInactiveRooms = false } = options;
  const checkInStr = String(checkIn).slice(0, 10);
  const checkOutStr = String(checkOut).slice(0, 10);
  const nights = calculateNights(checkInStr, checkOutStr);
  if (nights < 1) return { error: 'Invalid date range' };
  if (!rawLines?.length) return { error: 'At least one room is required' };

  const seenRooms = new Set();
  const pricedLines = [];
  let combinedSubtotal = 0;
  let combinedExtraCharges = 0;
  let combinedRoomSubtotal = 0;

  const { validateOccupancy } = await import('../config/resortRules.js');

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i];
    const roomId = parseInt(line.room_id, 10);
    if (!roomId) return { error: `Room ${i + 1}: select a room` };

    if (seenRooms.has(roomId)) {
      return { error: 'Each room can only be booked once per reservation. Choose a different room.' };
    }
    seenRooms.add(roomId);

    const roomSql = allowInactiveRooms
      ? 'SELECT * FROM rooms WHERE id = ?'
      : 'SELECT * FROM rooms WHERE id = ? AND is_active = 1';
    const [rooms] = await pool.query(roomSql, [roomId]);
    if (rooms.length === 0) return { error: `Room ${i + 1}: room not found` };
    const room = rooms[0];

    const occupancy = {
      adults: line.adults,
      childrenUnder6: line.children_under6,
      children7_12: line.children_7_12,
    };
    const occCheck = validateOccupancy(room, occupancy);
    if (!occCheck.valid) {
      return { error: `Room ${i + 1} (${room.name}): ${occCheck.message}` };
    }

    // Past (ante-dated) admin bookings skip calendar holds so staff can still record / SOA.
    if (!skipAvailabilityCheck) {
      const available = await isRoomAvailable(pool, roomId, checkInStr, checkOutStr);
      if (!available) {
        return { error: `${room.name} is not available for the selected dates` };
      }
    }

    const stay = await calculateStayTotal(pool, roomId, checkInStr, checkOutStr, occupancy);
    const guestCount = line.adults + line.children_under6 + line.children_7_12;
    const avgNightlyRate = nights > 0 ? stay.subtotal / nights : Number(room.price_per_night);

    pricedLines.push({
      room_id: roomId,
      room,
      adults: line.adults,
      children_under6: line.children_under6,
      children_7_12: line.children_7_12,
      guest_count: guestCount,
      nights,
      room_rate: avgNightlyRate,
      room_subtotal: stay.roomSubtotal,
      extra_person_charges: stay.extraPersonCharges || 0,
      subtotal: stay.subtotal,
      breakdown: stay.breakdown,
      extra_breakdown: stay.extraBreakdown,
      sort_order: line.sort_order ?? i,
    });

    combinedSubtotal += stay.subtotal;
    combinedExtraCharges += stay.extraPersonCharges || 0;
    combinedRoomSubtotal += stay.roomSubtotal;
  }

  const totalAdults = pricedLines.reduce((s, l) => s + l.adults, 0);
  const totalUnder6 = pricedLines.reduce((s, l) => s + l.children_under6, 0);
  const total712 = pricedLines.reduce((s, l) => s + l.children_7_12, 0);
  const totalGuests = totalAdults + totalUnder6 + total712;

  return {
    nights,
    lines: pricedLines,
    combinedSubtotal,
    combinedExtraCharges,
    combinedRoomSubtotal,
    totalAdults,
    totalUnder6,
    total712,
    totalGuests,
    primaryRoom: pricedLines[0].room,
    hasSuite: pricedLines.some((l) => l.room.room_type === 'suite'),
  };
}

export async function insertBookingRooms(pool, bookingId, pricedLines) {
  for (const line of pricedLines) {
    await pool.query(
      `INSERT INTO booking_rooms (
        booking_id, room_id, adults, children_under6, children_7_12, guest_count,
        nights, room_rate, room_subtotal, extra_person_charges, subtotal, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingId,
        line.room_id,
        line.adults,
        line.children_under6,
        line.children_7_12,
        line.guest_count,
        line.nights,
        line.room_rate,
        line.room_subtotal,
        line.extra_person_charges,
        line.subtotal,
        line.sort_order,
      ]
    );
  }
}

export async function fetchBookingRooms(pool, bookingId) {
  const [rows] = await pool.query(
    `SELECT br.*, r.name AS room_name, r.room_type, r.slug AS room_slug
     FROM booking_rooms br
     JOIN rooms r ON br.room_id = r.id
     WHERE br.booking_id = ?
     ORDER BY br.sort_order, br.id`,
    [bookingId]
  );
  return rows;
}

export async function attachBookingRooms(pool, booking) {
  if (!booking?.id) return booking;
  const room_lines = await fetchBookingRooms(pool, booking.id);
  const room_names =
    room_lines.length > 0
      ? room_lines.map((l) => l.room_name).join(', ')
      : booking.room_name || null;
  return {
    ...booking,
    room_lines,
    room_names,
    room_count: room_lines.length || 1,
  };
}

/** Load booking_rooms + custom add-ons before guest emails / SOA PDF (multi-room aware). */
export async function prepareBookingForEmail(pool, booking) {
  const enriched = await attachBookingRooms(pool, booking);
  // Load custom during-stay charges so the emailed PDF itemizes them like the admin
  // screen does (the on-screen doc fetches these via /bookings/admin/:id).
  let addons = [];
  try {
    const [rows] = await pool.query(
      'SELECT * FROM booking_addons WHERE booking_id = ? ORDER BY sort_order, created_at',
      [booking.id]
    );
    addons = rows || [];
  } catch (err) {
    console.warn('[Email prep] booking_addons unavailable:', err.message);
  }
  return {
    ...enriched,
    addons,
    room_name: enriched.room_names || enriched.room_name,
  };
}

export async function attachBookingRoomsToList(pool, bookings) {
  if (!bookings?.length) return bookings;
  const ids = bookings.map((b) => b.id);
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT br.*, r.name AS room_name, r.room_type, r.slug AS room_slug
     FROM booking_rooms br
     JOIN rooms r ON br.room_id = r.id
     WHERE br.booking_id IN (${placeholders})
     ORDER BY br.booking_id, br.sort_order, br.id`,
    ids
  );
  const byBooking = new Map();
  for (const row of rows) {
    if (!byBooking.has(row.booking_id)) byBooking.set(row.booking_id, []);
    byBooking.get(row.booking_id).push(row);
  }
  return bookings.map((b) => {
    const room_lines = byBooking.get(b.id) || [];
    return {
      ...b,
      room_lines,
      room_names:
        room_lines.length > 0
          ? room_lines.map((l) => l.room_name).join(', ')
          : b.room_name || null,
      room_count: room_lines.length || 1,
    };
  });
}
