import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import BookingSoaDocument from '../components/admin/BookingSoaDocument';
import Loading from '../components/ui/Loading';
import { clearMirroredAdminToken } from '../utils/islandHoppingPrintCache';
import { resolveSoaDocumentTitle, SOA_DOCUMENT_TYPES } from '../utils/soaDocumentTitle';

export default function BookingSoaPrint() {
  const { bookingId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const docType = searchParams.get('doc') === 'confirmation' ? 'confirmation' : 'soa';
  const documentTitle = resolveSoaDocumentTitle(docType);
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

  if (authLoading) return <Loading />;
  if (!user) return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen bg-white text-black p-6 md:p-10 print:p-0">
      <style>{`
        @page {
          size: letter;
          margin: 0.65in;
        }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white; }
          .soa-doc a { color: #498bc3 !important; }
        }
      `}</style>

      <div className="no-print max-w-[8.5in] mx-auto mb-6 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-aegean-700">
          <span className="font-medium">Document type</span>
          <select
            value={docType}
            onChange={(e) => setSearchParams({ doc: e.target.value })}
            className="border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="soa">{SOA_DOCUMENT_TYPES.soa.label}</option>
            <option value="confirmation">{SOA_DOCUMENT_TYPES.confirmation.label}</option>
          </select>
        </label>
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
      {error && <p className="text-red-600 max-w-[8.5in] mx-auto">{error}</p>}

      {!loading && !error && booking && (
        <BookingSoaDocument
          booking={booking}
          documentTitle={documentTitle}
          docType={docType}
        />
      )}
    </div>
  );
}
