import { addDays, format, isBefore, isSameDay, isValid, parseISO } from 'date-fns';

export const STAY_DATE_ERROR =
  'Check-out must be after check-in. Please choose a later check-out date.';

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
