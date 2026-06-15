import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import ButtonSpinner from '../components/ui/ButtonSpinner';
import Pagination from '../components/ui/Pagination';
import AdminModal from '../components/admin/AdminModal';
import BookingStayDetails from '../components/admin/BookingStayDetails';
import { useToast } from '../context/ToastContext';
import { usePagination } from '../hooks/usePagination';
import { getAssetUrl } from '../utils/assetUrl';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusChipClass = {
  confirmed: 'bg-green-100 text-green-800 hover:bg-green-200',
  payment_submitted: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  awaiting_payment: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
  pending: 'bg-aegean-100 text-aegean-700 hover:bg-aegean-200',
};

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function dateInRange(dateStr, checkIn, checkOut) {
  const d = dateStr;
  return d >= checkIn && d < checkOut;
}

export default function AdminCalendar() {
  const toast = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const { page, setPage, pageItems, totalPages, totalItems, from, to } = usePagination(bookings);

  useEffect(() => {
    setLoading(true);
    api
      .get('/bookings/admin/calendar', { params: { month, year } })
      .then((r) => setBookings(r.data))
      .finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => {
    setPage(1);
  }, [month, year, setPage]);

  const openBookingDetail = async (id) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedBooking(null);
    try {
      const { data } = await api.get(`/bookings/admin/${id}`);
      setSelectedBooking(data);
    } catch (err) {
      toast.error(getApiError(err));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeBookingDetail = () => {
    setDetailOpen(false);
    setSelectedBooking(null);
  };

  const chipClass = (status) =>
    statusChipClass[status] || 'bg-aegean-100 text-aegean-700 hover:bg-aegean-200';

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
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-serif text-aegean-800">Booking Calendar</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <select value={month} onChange={(e) => setMonth(+e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none min-w-[140px]">
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
          className="border rounded-lg px-3 py-2 w-24 text-sm"
        />
        </div>
        <Link to="/admin/bookings" className="text-sm text-aegean-600 hover:underline sm:ml-auto">
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
                  className={`min-h-[72px] sm:min-h-[88px] border-b border-r border-aegean-50 p-0.5 sm:p-1 ${
                    cell ? 'bg-white' : 'bg-aegean-50/50'
                  }`}
                >
                  {cell && (
                    <>
                      <span className="text-xs text-aegean-500 font-medium">{cell.day}</span>
                      <div className="mt-1 space-y-0.5">
                        {cell.bookings.slice(0, 2).map((b) => (
                          <button
                            key={`${b.id}-${cell.dateStr}`}
                            type="button"
                            title={`${b.guest_name} · ${b.reference_code}`}
                            onClick={() => openBookingDetail(b.id)}
                            className={`w-full text-left text-[10px] px-1 py-0.5 rounded truncate cursor-pointer transition-colors ${chipClass(b.status)}`}
                          >
                            {b.room_name}
                          </button>
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

          <h2 className="text-lg font-serif text-aegean-800 mb-4">Upcoming stays</h2>
          <div className="space-y-2">
            {bookings.length === 0 ? (
              <p className="text-aegean-600">No upcoming stays this month.</p>
            ) : (
              pageItems.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => openBookingDetail(b.id)}
                  className="w-full text-left bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-3 items-center text-sm hover:bg-aegean-50/80 hover:ring-1 hover:ring-aegean-200 transition-colors"
                >
                  <span className="font-mono text-aegean-600">{b.reference_code}</span>
                  <span className="font-medium">{b.guest_name}</span>
                  <span className="text-aegean-600">{b.room_name}</span>
                  <span>{b.check_in} → {b.check_out}</span>
                  <span className={`capitalize px-2 py-0.5 rounded-full text-xs ${chipClass(b.status)}`}>
                    {b.status.replace(/_/g, ' ')}
                  </span>
                </button>
              ))
            )}
            {bookings.length > 0 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                from={from}
                to={to}
                onPageChange={setPage}
              />
            )}
          </div>
        </>
      )}

      <AdminModal
        open={detailOpen}
        onClose={closeBookingDetail}
        title={selectedBooking ? `Booking ${selectedBooking.reference_code}` : 'Booking details'}
        description={selectedBooking?.room_name}
        size="lg"
        bodyClassName="p-6"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-aegean-600">
            <ButtonSpinner />
            Loading booking…
          </div>
        ) : selectedBooking ? (
          <>
            <BookingStayDetails
              booking={selectedBooking}
              onViewPaymentProof={
                selectedBooking.payment_proof_url
                  ? () => window.open(getAssetUrl(selectedBooking.payment_proof_url), '_blank', 'noopener,noreferrer')
                  : undefined
              }
            />
            <div className="mt-6 pt-4 border-t border-aegean-100">
              <Link
                to="/admin/bookings"
                onClick={closeBookingDetail}
                className="text-sm text-aegean-600 hover:text-aegean-800 underline"
              >
                Manage in Bookings →
              </Link>
            </div>
          </>
        ) : null}
      </AdminModal>
    </div>
  );
}
