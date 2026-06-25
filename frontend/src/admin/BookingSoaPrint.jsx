import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/ui/Loading';
import { formatGuestCount } from '../utils/guestCount';
import { getBookingPaymentSummary } from '../utils/bookingPayment';
import { clearMirroredAdminToken } from '../utils/islandHoppingPrintCache';

export default function BookingSoaPrint() {
  const { bookingId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId || !user) return;
    setLoading(true);
    api
      .get(`/bookings/admin/${bookingId}`)
      .then((r) => setBooking(r.data))
      .catch((err) => setError(getApiError(err)))
      .finally(() => setLoading(false));
  }, [bookingId, user]);

  useEffect(() => {
    if (!booking) return;
    const timer = setTimeout(() => window.print(), 700);
    return () => clearTimeout(timer);
  }, [booking]);

  useEffect(() => {
    const onPageHide = () => {
      clearMirroredAdminToken();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  const payment = useMemo(() => getBookingPaymentSummary(booking), [booking]);

  if (authLoading) return <Loading />;
  if (!user) return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen bg-white text-aegean-900 p-6 md:p-10">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="no-print max-w-3xl mx-auto mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aegean-600 text-white text-sm hover:bg-aegean-700"
        >
          <Printer size={16} /> Print
        </button>
        <Link
          to="/admin/bookings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-aegean-200 text-sm hover:bg-aegean-50"
        >
          <X size={16} /> Back to bookings
        </Link>
      </div>

      {loading && <Loading />}
      {error && <p className="text-red-600 max-w-3xl mx-auto">{error}</p>}

      {!loading && !error && booking && (
        <div className="max-w-3xl mx-auto border border-aegean-200 rounded-lg p-6 space-y-3">
          <h1 className="text-2xl font-serif">Booking Confirmation / Statement of Account</h1>
          <p className="text-sm text-aegean-600">Reference: {booking.reference_code}</p>
          <hr className="border-aegean-200 my-2" />
          <p><strong>Guest:</strong> {booking.guest_name}</p>
          <p><strong>Email:</strong> {booking.guest_email}</p>
          <p><strong>Phone:</strong> {booking.guest_phone}</p>
          <p><strong>Room:</strong> {booking.room_name}</p>
          <p><strong>Stay dates:</strong> {booking.check_in} to {booking.check_out} ({booking.nights} night{booking.nights !== 1 ? 's' : ''})</p>
          <p><strong>Guests:</strong> {formatGuestCount(booking)}</p>
          <hr className="border-aegean-200 my-2" />
          <p><strong>Booking total:</strong> ₱{payment.total.toLocaleString()}</p>
          <p><strong>{payment.upfrontLabel}:</strong> ₱{payment.payNow.toLocaleString()}</p>
          {payment.isPartial && <p><strong>Balance due:</strong> ₱{payment.balance.toLocaleString()}</p>}
          <p><strong>Payment method:</strong> {booking.payment_method_name || '—'}</p>
          <p><strong>Status:</strong> {booking.status.replace(/_/g, ' ')}</p>
        </div>
      )}
    </div>
  );
}
