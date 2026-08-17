/** Philippine Time — resort local timezone for all admin date/time display. */
export const PHT_TIMEZONE = 'Asia/Manila';

/**
 * Parse MySQL datetime strings from the API.
 * TIMESTAMP values are stored in UTC; mysql2 dateStrings return UTC wall-clock without a Z suffix.
 */
export function parseDbDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  // MySQL TIMESTAMP via dateStrings — stored as UTC, returned without timezone suffix
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw.replace(' ', 'T') + 'Z');
  }

  // ISO without timezone — treat as UTC from the API
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    return new Date(`${raw}Z`);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Full date + time in Philippine Time (e.g. for quotation "Updated" column). */
export function formatDateTimePHT(value, options = {}) {
  const date = parseDbDateTime(value);
  if (!date) return '—';

  return date.toLocaleString('en-PH', {
    timeZone: PHT_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...options,
  });
}

/** Date only in Philippine Time. */
export function formatDatePHT(value, options = {}) {
  const date = parseDbDateTime(value);
  if (!date) return '—';

  return date.toLocaleDateString('en-PH', {
    timeZone: PHT_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/**
 * YYYY-MM-DD for "today" in Philippine Time.
 * Check-in / check-out badges and filters use this so they flip at 12:00 AM PHT.
 */
export function todayYmdPHT(referenceDate = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PHT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceDate);
}

/** True when a YYYY-MM-DD stay date is the current calendar day in PHT. */
export function isTodayPHT(dateStr, referenceDate = new Date()) {
  if (!dateStr) return false;
  return String(dateStr).slice(0, 10) === todayYmdPHT(referenceDate);
}

/** Milliseconds until the next 12:00 AM Asia/Manila (for badge refresh). */
export function msUntilNextPhtMidnight(referenceDate = new Date()) {
  const today = todayYmdPHT(referenceDate);
  const startOfTodayPht = new Date(`${today}T00:00:00+08:00`);
  const startOfTomorrowPht = new Date(startOfTodayPht.getTime() + 24 * 60 * 60 * 1000);
  return Math.max(1000, startOfTomorrowPht.getTime() - referenceDate.getTime());
}
