import { useState } from 'react';
import { addDays, addMonths, format, isBefore, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StayMonthGrid from './StayMonthGrid';
import useRoomCalendar, { isCheckInNightAvailable, isStayRangeAvailable } from '../../hooks/useRoomCalendar';
import { minCheckInDate, minCheckOutDate } from '../../utils/stayDates';

function toApiDate(d) {
  return format(d, 'yyyy-MM-dd');
}

/**
 * Inline two-month calendar for picking check-in / check-out on a specific room.
 * Past nights and booked/blocked nights are disabled.
 */
export default function StayDateRangeCalendar({
  roomId,
  checkIn,
  checkOut,
  onChange,
  compact = false,
}) {
  const initialMonth = checkIn ? parseISO(checkIn) : addDays(parseISO(minCheckInDate()), 1);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(initialMonth);
    d.setDate(1);
    return d;
  });
  const [selectingEnd, setSelectingEnd] = useState(false);

  const { dayRates, loading, error, minDate, month2Start } = useRoomCalendar(roomId, viewMonth);

  const rangeStart = checkIn ? parseISO(checkIn) : null;
  const rangeEnd = checkOut ? parseISO(checkOut) : null;

  const handleSelectDay = (day) => {
    const dateStr = toApiDate(day);

    if (!selectingEnd) {
      if (!isCheckInNightAvailable(dateStr, dayRates)) return;
      const nextOut = minCheckOutDate(dateStr);
      onChange({
        check_in: dateStr,
        check_out:
          checkOut && nextOut && checkOut > dateStr && isStayRangeAvailable(dateStr, checkOut, dayRates)
            ? checkOut
            : nextOut,
      });
      setSelectingEnd(true);
      return;
    }

    if (isBefore(day, rangeStart) || isSameDay(day, rangeStart)) {
      if (!isCheckInNightAvailable(dateStr, dayRates)) return;
      onChange({ check_in: dateStr, check_out: minCheckOutDate(dateStr) });
      setSelectingEnd(true);
      return;
    }

    const outStr = dateStr;
    if (!isStayRangeAvailable(checkIn, outStr, dayRates)) return;
    onChange({ check_in: checkIn, check_out: outStr });
    setSelectingEnd(false);
  };

  if (!roomId) {
    return (
      <p className="text-xs text-aegean-500 bg-aegean-50 rounded-lg px-3 py-2">
        Select a room to see which dates are available.
      </p>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          className="p-1.5 hover:bg-aegean-50 rounded-lg text-aegean-600"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-xs text-aegean-600 text-center">
          {selectingEnd ? 'Select check-out' : 'Select check-in'}
          {loading ? ' · loading…' : ''}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="p-1.5 hover:bg-aegean-50 rounded-lg text-aegean-600"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div
        className={`flex flex-col sm:flex-row gap-4 sm:gap-6 transition-opacity ${
          loading ? 'opacity-60' : 'opacity-100'
        }`}
      >
        <StayMonthGrid
          monthDate={viewMonth}
          dayRates={dayRates}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onSelectDay={handleSelectDay}
          minDate={minDate}
          mode={selectingEnd ? 'departure' : 'arrival'}
          checkIn={checkIn}
        />
        <StayMonthGrid
          monthDate={month2Start}
          dayRates={dayRates}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onSelectDay={handleSelectDay}
          minDate={minDate}
          mode={selectingEnd ? 'departure' : 'arrival'}
          checkIn={checkIn}
        />
      </div>

      <p className="text-[11px] text-aegean-500 text-center">
        {error || 'Past dates and booked nights are blocked (×). Tap check-in, then check-out.'}
      </p>
    </div>
  );
}
