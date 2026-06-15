import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import IslandHoppingManifest from '../components/admin/IslandHoppingManifest';
import Loading from '../components/ui/Loading';
import { parseIslandHoppingData } from '../data/islandHoppingRates';
import { getAdminToken } from '../utils/adminAuth';
import {
  clearIslandHoppingPrintCache,
  clearMirroredAdminToken,
  readIslandHoppingPrintCache,
} from '../utils/islandHoppingPrintCache';

/**
 * Standalone print page (no admin sidebar). Opened in a new tab from admin → Print manifest.
 */
export default function IslandHoppingPrint() {
  const { bookingId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const prefetched = useMemo(() => readIslandHoppingPrintCache(bookingId), [bookingId]);
  const [booking, setBooking] = useState(prefetched?.booking ?? null);
  const [islandHop, setIslandHop] = useState(prefetched?.islandHop ?? null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!prefetched);

  useEffect(() => {
    if (prefetched) {
      setBooking(prefetched.booking);
      setIslandHop(prefetched.islandHop);
      setLoading(false);
      return;
    }

    if (!bookingId || !user) return;

    setLoading(true);
    api
      .get(`/bookings/admin/${bookingId}`)
      .then((r) => {
        const data = r.data;
        setBooking(data);
        setIslandHop(
          data?.island_hopping ? parseIslandHoppingData(data.island_hopping_data) : null
        );
      })
      .catch((err) => setError(getApiError(err)))
      .finally(() => setLoading(false));
  }, [bookingId, user, prefetched]);

  useEffect(() => {
    if (!booking || !islandHop) return;
    const timer = setTimeout(() => window.print(), 800);
    return () => clearTimeout(timer);
  }, [booking, islandHop]);

  useEffect(() => {
    const onPageHide = () => {
      clearMirroredAdminToken();
      clearIslandHoppingPrintCache();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  const token = getAdminToken();
  const usingPrefetch = Boolean(prefetched);

  if (!usingPrefetch) {
    if (authLoading || (token && !user)) return <Loading />;
    if (!user) return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-white text-aegean-800 p-6 md:p-10">
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
      {!loading && !error && booking && !islandHop && (
        <p className="max-w-3xl mx-auto text-aegean-600">
          This booking does not include island hopping.
        </p>
      )}
      {!loading && !error && booking && islandHop && (
        <IslandHoppingManifest booking={booking} islandHop={islandHop} />
      )}
    </div>
  );
}
