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
