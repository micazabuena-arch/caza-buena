import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Loading from '../components/ui/Loading';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function dateInRange(dateStr, checkIn, checkOut) {
  const d = dateStr;
  return d >= checkIn && d < checkOut;
}

export default function AdminCalendar() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/bookings/admin/calendar', { params: { month, year } })
      .then((r) => setBookings(r.data))
      .finally(() => setLoading(false));
  }, [month, year]);

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDow = new Date(year, month - 1, 1).getDay();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayBookings = bookings.filter((b) =>
        dateInRange(dateStr, b.check_in, b.check_out)
      );
      cells.push({ day: d, dateStr, bookings: dayBookings });
    }
    return cells;
  }, [bookings, month, year]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <h1 className="text-3xl font-serif text-aegean-800">Booking Calendar</h1>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} className="border rounded-lg px-3 py-2">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2000, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(+e.target.value)}
          className="border rounded-lg px-3 py-2 w-24"
        />
        <Link to="/admin/bookings" className="text-sm text-aegean-600 hover:underline ml-auto">
          Manage all bookings →
        </Link>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="grid grid-cols-7 border-b border-aegean-100 bg-aegean-50">
              {WEEKDAYS.map((w) => (
                <div key={w} className="p-2 text-center text-xs font-medium text-aegean-600">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((cell, i) => (
                <div
                  key={i}
                  className={`min-h-[88px] border-b border-r border-aegean-50 p-1 ${
                    cell ? 'bg-white' : 'bg-aegean-50/50'
                  }`}
                >
                  {cell && (
                    <>
                      <span className="text-xs text-aegean-500 font-medium">{cell.day}</span>
                      <div className="mt-1 space-y-0.5">
                        {cell.bookings.slice(0, 2).map((b) => (
                          <div
                            key={b.id}
                            title={`${b.guest_name} · ${b.room_name}`}
                            className={`text-[10px] px-1 py-0.5 rounded truncate ${
                              b.status === 'confirmed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-aegean-100 text-aegean-700'
                            }`}
                          >
                            {b.room_name}
                          </div>
                        ))}
                        {cell.bookings.length > 2 && (
                          <span className="text-[10px] text-aegean-400">+{cell.bookings.length - 2}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <h2 className="text-lg font-serif text-aegean-800 mb-4">This month</h2>
          <div className="space-y-2">
            {bookings.length === 0 ? (
              <p className="text-aegean-600">No bookings this month.</p>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-3 items-center text-sm">
                  <span className="font-mono text-aegean-600">{b.reference_code}</span>
                  <span className="font-medium">{b.guest_name}</span>
                  <span className="text-aegean-600">{b.room_name}</span>
                  <span>{b.check_in} → {b.check_out}</span>
                  <span className={`capitalize px-2 py-0.5 rounded-full text-xs ${
                    b.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-aegean-100'
                  }`}>
                    {b.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
