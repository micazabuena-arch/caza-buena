/**
 * Nightly rate logic: holiday override > weekend (Fri–Sun) > weekday (Mon–Thu)
 */

/** Friday=5, Saturday=6, Sunday=0 */
export function isWeekendNight(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  return day === 0 || day === 5 || day === 6;
}

export function getRateTypeLabel(dateStr) {
  return isWeekendNight(dateStr) ? 'weekend' : 'weekday';
}

/** Price for one night from room row + optional holiday row */
export function resolveNightlyPrice(room, dateStr, holidayRate = null) {
  if (holidayRate) return Number(holidayRate.price_per_night);
  if (isWeekendNight(dateStr)) {
    const weekend = room.price_weekend != null ? Number(room.price_weekend) : null;
    if (weekend != null && !Number.isNaN(weekend)) return weekend;
  }
  return Number(room.price_per_night);
}

/** Fetch holiday rate for a room on a specific night (check-in date of that night) */
export async function getHolidayRateForDate(pool, roomId, dateStr) {
  const [rows] = await pool.query(
    `SELECT * FROM room_holiday_rates
     WHERE room_id = ? AND start_date <= ? AND end_date >= ?
     ORDER BY start_date DESC LIMIT 1`,
    [roomId, dateStr, dateStr]
  );
  return rows[0] || null;
}

/** Nightly rate for one room on one date */
export async function getNightlyRate(pool, roomId, dateStr) {
  const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
  if (rooms.length === 0) return null;
  const holiday = await getHolidayRateForDate(pool, roomId, dateStr);
  return resolveNightlyPrice(rooms[0], dateStr, holiday);
}

/** Sum rates for each night in stay (check_in inclusive, check_out exclusive) */
export async function calculateStayTotal(pool, roomId, checkIn, checkOut, occupancy = null) {
  const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
  if (rooms.length === 0) return { subtotal: 0, nights: 0, breakdown: [] };

  const room = rooms[0];
  const [holidays] = await pool.query(
    'SELECT * FROM room_holiday_rates WHERE room_id = ? AND end_date > ? AND start_date < ?',
    [roomId, checkIn, checkOut]
  );

  const breakdown = [];
  const cursor = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);

  while (cursor < end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const holiday = holidays.find((h) => dateStr >= h.start_date && dateStr <= h.end_date);
    const rate = resolveNightlyPrice(room, dateStr, holiday);
    breakdown.push({
      date: dateStr,
      rate,
      type: holiday ? 'holiday' : getRateTypeLabel(dateStr),
      label: holiday?.label || null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const roomSubtotal = breakdown.reduce((sum, n) => sum + n.rate, 0);
  let extraPersonCharges = 0;
  let extraBreakdown = null;

  if (occupancy && occupancy.adults != null) {
    const { calculateExtraPersonCharges } = await import('../config/resortRules.js');
    extraBreakdown = calculateExtraPersonCharges(room, occupancy);
    extraPersonCharges = extraBreakdown.nightlyExtra * breakdown.length;
  }

  const subtotal = roomSubtotal + extraPersonCharges;
  return {
    subtotal,
    roomSubtotal,
    extraPersonCharges,
    extraBreakdown,
    nights: breakdown.length,
    breakdown,
  };
}
