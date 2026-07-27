/** Client-side room line for multi-room bookings. */
export function createRoomLine(overrides = {}) {
  return {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    room_id: '',
    adults: 2,
    children_under6: 0,
    children_7_12: 0,
    ...overrides,
  };
}

export function roomLineGuestCount(line) {
  return (
    (parseInt(line.adults, 10) || 0) +
    (parseInt(line.children_under6, 10) || 0) +
    (parseInt(line.children_7_12, 10) || 0)
  );
}

export function totalGuestsFromLines(lines) {
  return (lines || []).reduce((sum, line) => sum + roomLineGuestCount(line), 0);
}

export function roomLinesToPayload(lines) {
  return (lines || [])
    .filter((line) => line.room_id)
    .map((line) => ({
      room_id: parseInt(line.room_id, 10),
      adults: parseInt(line.adults, 10) || 1,
      children_under6: parseInt(line.children_under6, 10) || 0,
      children_7_12: parseInt(line.children_7_12, 10) || 0,
    }));
}

export function usedRoomIds(lines, excludeLineId = null) {
  return new Set(
    (lines || [])
      .filter((line) => line.id !== excludeLineId && line.room_id)
      .map((line) => String(line.room_id))
  );
}

/** Build editable room lines from a booking (multi-room or legacy single room). */
export function bookingToRoomLines(booking) {
  if (Array.isArray(booking?.room_lines) && booking.room_lines.length > 0) {
    return booking.room_lines.map((line) =>
      createRoomLine({
        room_id: line.room_id ? String(line.room_id) : '',
        adults: line.adults ?? 1,
        children_under6: line.children_under6 ?? 0,
        children_7_12: line.children_7_12 ?? 0,
      })
    );
  }

  return [
    createRoomLine({
      room_id: booking?.room_id ? String(booking.room_id) : '',
      adults: booking?.adults ?? 1,
      children_under6: booking?.children_under6 ?? 0,
      children_7_12: booking?.children_7_12 ?? 0,
    }),
  ];
}

export function roomLinesPayloadEqual(a, b) {
  return JSON.stringify(roomLinesToPayload(a)) === JSON.stringify(roomLinesToPayload(b));
}
