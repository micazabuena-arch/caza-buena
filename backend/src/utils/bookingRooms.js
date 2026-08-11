import { calculateNights, isRoomAvailable } from './booking.js';
import { calculateStayTotal } from './pricing.js';
import { enrichBookingRoomLine } from './roomLabels.js';

/** Normalize API body to room line objects. */
export function normalizeRoomLines(body) {
  if (Array.isArray(body.room_lines) && body.room_lines.length > 0) {
    return body.room_lines.map((line, index) => ({
      room_id: parseInt(line.room_id, 10),
      adults: parseInt(line.adults, 10) || 1,
      children_under6: parseInt(line.children_under6, 10) || 0,
      children_7_12: parseInt(line.children_7_12, 10) || 0,
      assigned_room_number: String(line.assigned_room_number || '').trim() || null,
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
  const {
    skipAvailabilityCheck = false,
    allowInactiveRooms = false,
    excludeBookingId = null,
  } = options;
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
      const available = await isRoomAvailable(
        pool,
        roomId,
        checkInStr,
        checkOutStr,
        excludeBookingId
      );
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
      assigned_room_number: line.assigned_room_number || null,
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

/**
 * Replace API-calculated stay totals with amounts quoted to the guest.
 * Used when creating a manual booking from a quotation.
 */
export function applyQuotedStayPricing(priced, { quotedStaySubtotal, quotedLineSubtotals } = {}) {
  const stayTotal = Number(quotedStaySubtotal);
  if (!Number.isFinite(stayTotal) || stayTotal < 0) return priced;

  const lines = priced.lines.map((line) => ({ ...line }));

  if (Array.isArray(quotedLineSubtotals) && quotedLineSubtotals.length === lines.length) {
    let combined = 0;
    lines.forEach((line, index) => {
      const sub = Number(quotedLineSubtotals[index]);
      const safeSub = Number.isFinite(sub) && sub >= 0 ? sub : 0;
      line.subtotal = safeSub;
      line.room_subtotal = safeSub;
      line.extra_person_charges = 0;
      line.room_rate = priced.nights > 0 ? safeSub / priced.nights : safeSub;
      combined += safeSub;
    });

    return {
      ...priced,
      lines,
      combinedSubtotal: combined,
      combinedRoomSubtotal: combined,
      combinedExtraCharges: 0,
    };
  }

  if (lines.length === 1) {
    const line = lines[0];
    line.subtotal = stayTotal;
    line.room_subtotal = stayTotal;
    line.extra_person_charges = 0;
    line.room_rate = priced.nights > 0 ? stayTotal / priced.nights : stayTotal;
    return {
      ...priced,
      lines,
      combinedSubtotal: stayTotal,
      combinedRoomSubtotal: stayTotal,
      combinedExtraCharges: 0,
    };
  }

  const apiTotal = priced.combinedSubtotal || 0;
  let combined = 0;
  lines.forEach((line, index) => {
    const ratio = apiTotal > 0 ? line.subtotal / apiTotal : 1 / lines.length;
    const sub = Math.round(stayTotal * ratio * 100) / 100;
    line.subtotal = sub;
    line.room_subtotal = sub;
    line.extra_person_charges = 0;
    line.room_rate = priced.nights > 0 ? sub / priced.nights : sub;
    combined += sub;
  });

  if (lines.length > 0 && Math.abs(combined - stayTotal) > 0.01) {
    const diff = stayTotal - combined;
    const last = lines[lines.length - 1];
    last.subtotal += diff;
    last.room_subtotal += diff;
    last.room_rate = priced.nights > 0 ? last.subtotal / priced.nights : last.subtotal;
    combined = stayTotal;
  }

  return {
    ...priced,
    lines,
    combinedSubtotal: combined,
    combinedRoomSubtotal: combined,
    combinedExtraCharges: 0,
  };
}

export async function insertBookingRooms(pool, bookingId, pricedLines) {
  for (const line of pricedLines) {
    const assignedNumber = line.assigned_room_number
      ? String(line.assigned_room_number).trim().slice(0, 100)
      : null;
    await pool.query(
      `INSERT INTO booking_rooms (
        booking_id, room_id, assigned_room_number, adults, children_under6, children_7_12, guest_count,
        nights, room_rate, room_subtotal, extra_person_charges, subtotal, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingId,
        line.room_id,
        assignedNumber,
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
  return rows.map(enrichBookingRoomLine);
}

export async function attachBookingRooms(pool, booking) {
  if (!booking?.id) return booking;
  const room_lines = await fetchBookingRooms(pool, booking.id);
  const room_names =
    room_lines.length > 0
      ? room_lines.map((l) => l.admin_room_display || l.room_name).join(', ')
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
    const enriched = enrichBookingRoomLine(row);
    if (!byBooking.has(row.booking_id)) byBooking.set(row.booking_id, []);
    byBooking.get(row.booking_id).push(enriched);
  }
  return bookings.map((b) => {
    const room_lines = byBooking.get(b.id) || [];
    return {
      ...b,
      room_lines,
      room_names:
        room_lines.length > 0
          ? room_lines.map((l) => l.admin_room_display || l.room_name).join(', ')
          : b.room_name || null,
      room_count: room_lines.length || 1,
    };
  });
}
