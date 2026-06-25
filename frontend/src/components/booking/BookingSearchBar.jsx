import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import {
  format,
  addDays,
  addMonths,
  isBefore,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from 'date-fns';
import api from '../../api/client';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toApiDate(d) {
  return format(d, 'yyyy-MM-dd');
}

function displayDate(d) {
  return format(d, 'dd/MM/yyyy');
}

const MonthGrid = function MonthGrid({ monthDate, dayRates, rangeStart, rangeEnd, onSelectDay, minDate }) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // Monday-first offset
  const startPad = (monthStart.getDay() + 6) % 7;

  return (
    <div className="flex-1 min-w-[240px]">
      <h4 className="text-center font-medium text-aegean-800 mb-3">
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
          <div key={`pad-${i}`} className="h-14" />
        ))}
        {days.map((day) => {
          const key = toApiDate(day);
          const info = dayRates[key];
          const past = isBefore(day, minDate) && !isSameDay(day, minDate);
          const unavailable = !info?.available || past;
          const inRange =
            rangeStart &&
            rangeEnd &&
            !isBefore(day, rangeStart) &&
            !isBefore(rangeEnd, day) &&
            (isSameDay(day, rangeStart) || isSameDay(day, rangeEnd) || (day > rangeStart && day < rangeEnd));
          const isStart = rangeStart && isSameDay(day, rangeStart);
          const isEnd = rangeEnd && isSameDay(day, rangeEnd);

          return (
            <button
              key={key}
              type="button"
              disabled={unavailable}
              onClick={() => !unavailable && onSelectDay(day)}
              className={`h-14 flex flex-col items-center justify-center rounded-sm text-xs transition-colors ${
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
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function BookingSearchBar({ className = '' }) {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const barRef = useRef(null);
  const calendarRef = useRef(null);
  const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0, width: 0 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [checkIn, setCheckIn] = useState(addDays(today, 1));
  const [checkOut, setCheckOut] = useState(addDays(today, 2));
  const [guestInput, setGuestInput] = useState('2');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarFocus, setCalendarFocus] = useState('arrival');
  const [viewMonth, setViewMonth] = useState(startOfMonth(addDays(today, 1)));
  const [dayRates, setDayRates] = useState({});
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState('');

  const viewMonthKey = format(viewMonth, 'yyyy-MM');
  const month2Start = useMemo(() => startOfMonth(addMonths(viewMonth, 1)), [viewMonthKey]);
  const guests = useMemo(() => {
    const parsed = parseInt(guestInput, 10);
    if (Number.isNaN(parsed)) return 1;
    return Math.min(10, Math.max(1, parsed));
  }, [guestInput]);
  const fetchKey = `${viewMonthKey}|${guests}`;

  // Fetch two visible months; stable deps + debounce to avoid twitching on guest change
  useEffect(() => {
    if (!calendarOpen) return;

    const from = toApiDate(startOfMonth(viewMonth));
    const to = toApiDate(endOfMonth(month2Start));
    let cancelled = false;

    const timer = setTimeout(() => {
      setRatesLoading(true);
      setRatesError('');

      api
        .get('/bookings/rate-calendar', { params: { from, to, guests } })
        .then((r) => {
          if (cancelled) return;
          setDayRates((prev) => ({ ...prev, ...r.data.days }));
        })
        .catch((err) => {
          if (cancelled) return;
          setRatesError(
            err.response?.data?.message ||
              'Could not load rates. Please try again in a moment.'
          );
        })
        .finally(() => {
          if (!cancelled) setRatesLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // fetchKey = yyyy-MM|guests — avoids re-fetch loop from new Date() references each render
  }, [calendarOpen, fetchKey]);

  useEffect(() => {
    function handleClickOutside(e) {
      const inBar = wrapperRef.current?.contains(e.target);
      const inCalendar = calendarRef.current?.contains(e.target);
      if (!inBar && !inCalendar) setCalendarOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateCalendarPosition = () => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    setCalendarPos({
      top: rect.bottom + 8,
      left: Math.max(16, rect.left),
      width: Math.min(rect.width, window.innerWidth - 32),
    });
  };

  const openCalendar = (focus) => {
    setCalendarFocus(focus);
    if (focus === 'arrival') setSelectingEnd(false);
    updateCalendarPosition();
    setCalendarOpen(true);
  };

  useEffect(() => {
    if (!calendarOpen) return;
    updateCalendarPosition();
    let raf = 0;
    const onReflow = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateCalendarPosition);
    };
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [calendarOpen]);

  const handleSelectDay = (day) => {
    if (!selectingEnd) {
      setCheckIn(day);
      const next = addDays(day, 1);
      setCheckOut(isBefore(checkOut, next) || isSameDay(checkOut, day) ? next : checkOut);
      setSelectingEnd(true);
      setCalendarFocus('departure');
    } else {
      if (isBefore(day, checkIn) || isSameDay(day, checkIn)) {
        setCheckIn(day);
        setCheckOut(addDays(day, 1));
      } else {
        setCheckOut(day);
        setCalendarOpen(false);
        setSelectingEnd(false);
      }
    }
  };

  const handleFind = () => {
    const params = new URLSearchParams({
      check_in: toApiDate(checkIn),
      check_out: toApiDate(checkOut),
      guests: String(guests),
    });
    navigate(`/rooms?${params.toString()}`);
  };

  const calendarDropdown = (
    <div
      ref={calendarRef}
      className="bg-white rounded-xl shadow-2xl border border-aegean-100 p-4 md:p-6"
      style={{
        position: 'fixed',
        top: calendarPos.top,
        left: calendarPos.left,
        width: calendarPos.width,
        maxWidth: 'min(calc(100vw - 2rem), 720px)',
        zIndex: 9999,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          className="p-2 hover:bg-aegean-50 rounded-lg"
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="text-sm text-aegean-600">
          {calendarFocus === 'arrival' || !selectingEnd
            ? 'Select arrival date'
            : 'Select departure date'}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="p-2 hover:bg-aegean-50 rounded-lg"
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div
        className={`flex flex-col md:flex-row gap-6 md:gap-8 overflow-x-auto transition-opacity duration-200 ${
          ratesLoading ? 'opacity-60' : 'opacity-100'
        }`}
      >
        <MonthGrid
          monthDate={viewMonth}
          dayRates={dayRates}
          rangeStart={checkIn}
          rangeEnd={checkOut}
          onSelectDay={handleSelectDay}
          minDate={today}
        />
        <MonthGrid
          monthDate={month2Start}
          dayRates={dayRates}
          rangeStart={checkIn}
          rangeEnd={checkOut}
          onSelectDay={handleSelectDay}
          minDate={today}
        />
      </div>
      <p className="text-xs text-aegean-500 mt-4 text-center min-h-[2.5rem] flex items-center justify-center">
        {ratesError ||
          `Lowest rate per night for ${guests} guest${guests !== 1 ? 's' : ''} · Unavailable dates marked with ×`}
      </p>
    </div>
  );

  return (
    <div ref={wrapperRef} className={`relative z-30 ${className}`}>
      <div ref={barRef} className="bg-aegean-500 rounded-lg shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          {/* Brand column */}
          <div className="hidden sm:flex flex-col justify-center px-6 py-5 lg:py-0 lg:min-w-[140px] border-b lg:border-b-0 lg:border-r border-aegean-600">
            <p className="text-white font-bold text-lg tracking-wide">BOOKING</p>
            <p className="text-aegean-300 text-xs mt-1">Best price guarantee</p>
          </div>

          {/* Fields */}
          <div className="flex-1 flex flex-col sm:flex-row sm:items-end gap-0 sm:gap-1 p-4 sm:p-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openCalendar('arrival');
              }}
              className="flex-1 text-left px-4 py-3 sm:py-4 border-b sm:border-b-0 sm:border-r border-aegean-600/50 hover:bg-aegean-600/40 transition-colors"
            >
              <span className="text-white/80 text-xs block mb-1">Arrival</span>
              <span className="flex items-center justify-between gap-2 text-white font-medium">
                {displayDate(checkIn)}
                <Calendar size={18} className="text-white/70 shrink-0" />
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openCalendar('departure');
              }}
              className="flex-1 text-left px-4 py-3 sm:py-4 border-b sm:border-b-0 sm:border-r border-aegean-600/50 hover:bg-aegean-600/40 transition-colors"
            >
              <span className="text-white/80 text-xs block mb-1">Departure</span>
              <span className="flex items-center justify-between gap-2 text-white font-medium">
                {displayDate(checkOut)}
                <Calendar size={18} className="text-white/70 shrink-0" />
              </span>
            </button>

            <div className="flex-1 px-4 py-3 sm:py-4 sm:border-r border-aegean-700/50">
              <span className="text-white/80 text-xs block mb-1">Guests</span>
              <div className="relative flex items-center">
                <Users size={18} className="text-white/70 absolute left-0 pointer-events-none" />
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={guestInput}
                  onChange={(e) => setGuestInput(e.target.value)}
                  onBlur={() => setGuestInput(String(guests))}
                  className="w-full bg-transparent text-white font-medium pl-7 pr-2 outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleFind}
              className="m-3 sm:m-2 lg:min-w-[120px] bg-white text-aegean-900 font-bold text-lg tracking-wide py-4 sm:py-5 px-8 rounded hover:bg-aegean-50 transition-colors shrink-0"
            >
              FIND
            </button>
          </div>
        </div>

      </div>

      {calendarOpen && createPortal(calendarDropdown, document.body)}
    </div>
  );
}
