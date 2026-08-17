/** Guest-facing room labels — hide physical unit numbers (ROOM 101, etc.). */

const GUEST_LABELS = {
  suite: 'Suite Room (2 bedrooms)',
  queen: 'Queen Room (1 bedroom)',
};

/** Remove unit numbers from a stored room name (ROOM 101 → empty / leftover title). */
export function stripRoomNumberFromName(name) {
  if (!name) return '';
  return String(name)
    .replace(/\broom\s*#?\s*\d+\b/gi, '')
    .replace(/#?\b\d{3}\b/g, '')
    .replace(/\s*[-–—]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getGuestRoomLabel(roomOrType) {
  if (!roomOrType) return 'Room';
  if (typeof roomOrType === 'string') {
    return GUEST_LABELS[roomOrType] || 'Room';
  }

  const stripped = stripRoomNumberFromName(roomOrType.name);
  if (stripped && !/^room$/i.test(stripped)) return stripped;

  const type = roomOrType.room_type;
  return GUEST_LABELS[type] || roomOrType.name || 'Room';
}

/** Strip admin-only fields and mask room numbers for public guest views. */
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

/** Keep every room, but hide unit numbers on public APIs. */
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
