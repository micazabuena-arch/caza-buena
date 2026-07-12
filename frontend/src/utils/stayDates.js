import { addDays, format, isBefore, isSameDay, isValid, parseISO } from 'date-fns';

export const STAY_DATE_ERROR =
  'Check-out must be after check-in. Please choose a later check-out date.';

/** Earliest selectable check-in (today, local). Used on the public guest booking form. */
export function minCheckInDate(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  d.setHours(0, 0, 0, 0);
  return format(d, 'yyyy-MM-dd');
}

/** True when the date is before today (admin ante-date / late recording). */
export function isPastStayDate(dateStr, referenceDate = new Date()) {
  if (!dateStr) return false;
  const day = parseISO(dateStr);
  const min = parseISO(minCheckInDate(referenceDate));
  if (!isValid(day) || !isValid(min)) return false;
  return isBefore(day, min) && !isSameDay(day, min);
}

/** Returns an error message when stay dates are invalid, otherwise null. */
export function getStayDateError(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;

  const inDate = parseISO(checkIn);
  const outDate = parseISO(checkOut);
  if (!isValid(inDate) || !isValid(outDate)) {
    return 'Please enter valid check-in and check-out dates.';
  }
  if (isBefore(outDate, inDate) || isSameDay(outDate, inDate)) {
    return STAY_DATE_ERROR;
  }
  return null;
}

/** Earliest allowed check-out (day after check-in) for date inputs. */
export function minCheckOutDate(checkIn) {
  if (!checkIn) return undefined;
  const inDate = parseISO(checkIn);
  if (!isValid(inDate)) return undefined;
  return format(addDays(inDate, 1), 'yyyy-MM-dd');
}
