import { todayYmdPHT } from './datetime';

/** Room names for a booking list/detail row (multi-room aware). */
export function getBookingRoomNames(booking) {
  if (Array.isArray(booking?.room_lines) && booking.room_lines.length > 0) {
    return booking.room_lines
      .map(
        (line) =>
          line.assigned_room_number ||
          line.admin_room_display ||
          line.room_name ||
          line.guest_room_label ||
          ''
      )
      .map((name) => String(name).trim())
      .filter(Boolean);
  }

  const joined = String(booking?.room_names || booking?.room_name || '').trim();
  if (!joined) return [];
  return joined
    .split(/\s*,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Compact room label for dense admin tables.
 * Multi-room stays show a count + truncated list (full list in title tooltip).
 */
export function formatBookingRoomsCompact(booking, { maxVisible = 2 } = {}) {
  const names = getBookingRoomNames(booking);
  if (names.length === 0) {
    return { summary: '—', detail: '', full: '', count: 0 };
  }
  if (names.length === 1) {
    return { summary: names[0], detail: '', full: names[0], count: 1 };
  }

  const visible = names.slice(0, maxVisible);
  const hidden = names.length - visible.length;
  return {
    summary: `${names.length} rooms`,
    detail: hidden > 0 ? `${visible.join(' · ')} · +${hidden} more` : visible.join(' · '),
    full: names.join(', '),
    count: names.length,
  };
}

/** Stay has ended (check-out date is before today in PHT). */
export function isBookingStayPast(booking, referenceDate = new Date()) {
  const checkOut = String(booking?.check_out || '').slice(0, 10);
  if (!checkOut) return false;
  return checkOut < todayYmdPHT(referenceDate);
}

/** Guest is currently in-house (check-in ≤ today < check-out) in PHT. */
export function isBookingStayInHouse(booking, referenceDate = new Date()) {
  const checkIn = String(booking?.check_in || '').slice(0, 10);
  const checkOut = String(booking?.check_out || '').slice(0, 10);
  if (!checkIn || !checkOut) return false;
  const today = todayYmdPHT(referenceDate);
  return checkIn <= today && today < checkOut;
}
