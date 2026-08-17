/** Guest-facing room labels for bookings & the public rooms catalog. */

const GUEST_LABELS = {
  suite: 'Suite Room (2 bedrooms)',
  queen: 'Queen Room (1 bedroom)',
};

/** True when the stored name is only a physical unit code (e.g. ROOM 101). */
export function isPhysicalRoomCode(name) {
  const raw = String(name || '').trim();
  if (!raw) return false;
  return /^room\s*#?\s*\d+$/i.test(raw) || /^\d{3}$/.test(raw);
}

/**
 * Guest-visible room title.
 * Keep inventory labels like "Queen Room 1" / "QUEEN ROOM 2".
 * Only collapse pure physical codes (ROOM 101) to the generic type label.
 * Booking-level assigned_room_number stays admin-only via sanitizeBookingForGuest.
 */
export function getGuestRoomLabel(roomOrType) {
  if (!roomOrType) return 'Room';
  if (typeof roomOrType === 'string') {
    return GUEST_LABELS[roomOrType] || 'Room';
  }

  const name = String(roomOrType.name || '').trim();
  if (name && !isPhysicalRoomCode(name)) return name;

  const type = roomOrType.room_type;
  return GUEST_LABELS[type] || name || 'Room';
}

/** @deprecated kept for older imports — prefer isPhysicalRoomCode / getGuestRoomLabel */
export function stripRoomNumberFromName(name) {
  if (!name) return '';
  if (isPhysicalRoomCode(name)) return '';
  return String(name).trim();
}

/** Strip admin-only fields; keep friendly unit names on guest booking views. */
export function sanitizeBookingForGuest(booking) {
  if (!booking) return booking;

  const room_lines = (booking.room_lines || []).map((line) => {
    const guest_room_label = getGuestRoomLabel(line);
    return {
      id: line.id,
      room_id: line.room_id,
      room_type: line.room_type,
      room_name: guest_room_label,
      guest_room_label,
      adults: line.adults,
      children_under6: line.children_under6,
      children_7_12: line.children_7_12,
      guest_count: line.guest_count,
      nights: line.nights,
      sort_order: line.sort_order,
    };
  });

  const guestPrimaryLabel =
    room_lines[0]?.guest_room_label || getGuestRoomLabel(booking.room_type);

  return {
    ...booking,
    room_name: guestPrimaryLabel,
    room_names: room_lines.map((l) => l.guest_room_label).join(', ') || guestPrimaryLabel,
    room_lines,
    assigned_room_number: undefined,
    admin_room_display: undefined,
  };
}

/** Enrich a booking_rooms row for API responses. */
export function enrichBookingRoomLine(line) {
  const guest_room_label = getGuestRoomLabel(line);
  const assigned_room_number = line.assigned_room_number?.trim() || null;
  return {
    ...line,
    guest_room_label,
    assigned_room_number,
    admin_room_display: assigned_room_number || line.room_name,
  };
}

/** Public rooms API — show Queen Room 1 / 2, hide only pure physical codes. */
export function sanitizeRoomForGuest(room) {
  if (!room) return room;
  const guest_name = getGuestRoomLabel(room);
  return {
    ...room,
    name: guest_name,
    guest_room_label: guest_name,
  };
}

export function sanitizeRoomsForGuest(rooms) {
  return (rooms || []).map(sanitizeRoomForGuest);
}
