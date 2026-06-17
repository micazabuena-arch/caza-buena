import { useEffect, useMemo, useState } from 'react';
import { addMonths, endOfMonth, format, isBefore, isSameDay, parseISO, startOfMonth } from 'date-fns';
import api from '../api/client';
import { minCheckInDate } from '../utils/stayDates';

function toApiDate(d) {
  return format(d, 'yyyy-MM-dd');
}

/** Every night in [checkIn, checkOut) must be available in dayRates. */
export function isStayRangeAvailable(checkIn, checkOut, dayRates) {
  if (!checkIn || !checkOut) return false;
  const start = parseISO(checkIn);
  const end = parseISO(checkOut);
  if (isBefore(end, start) || isSameDay(end, start)) return false;

  let cursor = new Date(start);
  let checked = 0;
  while (isBefore(cursor, end)) {
    const key = toApiDate(cursor);
    const info = dayRates[key];
    if (info != null) {
      checked += 1;
      if (!info.available) return false;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return checked > 0 || Object.keys(dayRates).length === 0;
}

export function isCheckInNightAvailable(checkIn, dayRates) {
  if (!checkIn) return false;
  const info = dayRates[checkIn];
  if (info == null) return true;
  return Boolean(info.available);
}

export default function useRoomCalendar(roomId, viewMonth) {
  const [dayRates, setDayRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const month2Start = useMemo(() => startOfMonth(addMonths(viewMonth, 1)), [viewMonth]);
  const fetchKey = `${roomId}|${format(viewMonth, 'yyyy-MM')}`;

  useEffect(() => {
    if (!roomId) {
      setDayRates({});
      setError('');
      return;
    }

    const from = toApiDate(startOfMonth(viewMonth));
    const to = toApiDate(endOfMonth(month2Start));
    let cancelled = false;

    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      api
        .get('/bookings/room-calendar', { params: { room_id: roomId, from, to } })
        .then((r) => {
          if (cancelled) return;
          setDayRates((prev) => ({ ...prev, ...r.data.days }));
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err.response?.data?.message || 'Could not load room availability.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [roomId, fetchKey, viewMonth, month2Start]);

  const minDate = useMemo(() => {
    const d = parseISO(minCheckInDate());
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return { dayRates, loading, error, minDate, month2Start };
}
