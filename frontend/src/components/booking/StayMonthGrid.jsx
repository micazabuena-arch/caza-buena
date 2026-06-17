import {
  format,
  isBefore,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from 'date-fns';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toApiDate(d) {
  return format(d, 'yyyy-MM-dd');
}

/**
 * Month grid for stay date selection.
 * dayRates[yyyy-MM-dd] = { available: boolean, min_price?: number }
 */
export default function StayMonthGrid({
  monthDate,
  dayRates = {},
  rangeStart,
  rangeEnd,
  onSelectDay,
  minDate,
  mode = 'arrival',
  checkIn,
  showPrices = false,
}) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (monthStart.getDay() + 6) % 7;

  const canSelectCheckOut = (day) => {
    if (!checkIn) return false;
    const inDate = new Date(`${checkIn}T12:00:00`);
    if (isBefore(day, inDate) || isSameDay(day, inDate)) return false;

    let cursor = new Date(inDate);
    while (isBefore(cursor, day)) {
      const key = toApiDate(cursor);
      const info = dayRates[key];
      if (info != null && !info.available) return false;
      cursor.setDate(cursor.getDate() + 1);
    }
    return true;
  };

  return (
    <div className="flex-1 min-w-[220px]">
      <h4 className="text-center font-medium text-aegean-800 mb-3 text-sm">
        {format(monthDate, 'MMMM yyyy')}
      </h4>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs mb-1">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={`py-1 font-medium ${i >= 5 ? 'text-aegean-400' : 'text-aegean-600'}`}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="h-11" />
        ))}
        {days.map((day) => {
          const key = toApiDate(day);
          const info = dayRates[key];
          const past = minDate && isBefore(day, minDate) && !isSameDay(day, minDate);
          const nightUnavailable = !info?.available;
          const arrivalBlocked = past || nightUnavailable;
          const departureBlocked =
            past || !canSelectCheckOut(day);
          const unavailable = mode === 'departure' ? departureBlocked : arrivalBlocked;

          const inRange =
            rangeStart &&
            rangeEnd &&
            !isBefore(day, rangeStart) &&
            !isBefore(rangeEnd, day) &&
            (isSameDay(day, rangeStart) ||
              isSameDay(day, rangeEnd) ||
              (day > rangeStart && day < rangeEnd));
          const isStart = rangeStart && isSameDay(day, rangeStart);
          const isEnd = rangeEnd && isSameDay(day, rangeEnd);

          return (
            <button
              key={key}
              type="button"
              disabled={unavailable}
              onClick={() => !unavailable && onSelectDay(day)}
              className={`h-11 flex flex-col items-center justify-center rounded-sm text-xs transition-colors ${
                unavailable
                  ? 'text-gray-300 cursor-not-allowed'
                  : inRange
                    ? isStart || isEnd
                      ? 'bg-aegean-600 text-white'
                      : 'bg-aegean-100 text-aegean-800'
                    : 'hover:bg-aegean-50 text-aegean-800'
              }`}
            >
              <span
                className={`font-medium ${
                  isStart || isEnd
                    ? 'text-white'
                    : !unavailable && (day.getDay() === 0 || day.getDay() === 6)
                      ? 'text-aegean-400'
                      : ''
                }`}
              >
                {unavailable && !past ? '×' : format(day, 'd')}
              </span>
              {showPrices && (
                <span
                  className={`text-[10px] font-medium leading-tight mt-0.5 h-3.5 block ${
                    isStart || isEnd
                      ? 'text-white'
                      : info?.available && info.min_price != null && !past
                        ? 'text-green-700'
                        : 'text-transparent select-none'
                  }`}
                  aria-hidden={!(info?.available && info.min_price != null && !past)}
                >
                  {info?.available && info.min_price != null && !past
                    ? `₱${Number(info.min_price).toLocaleString()}`
                    : '·'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
