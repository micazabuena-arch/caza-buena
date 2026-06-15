import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Loading from '../components/ui/Loading';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const { stats, recent_bookings } = data;

  return <DashboardContent stats={stats} recent_bookings={recent_bookings || []} />;
}

function DashboardContent({ stats, recent_bookings }) {
  const { page, setPage, pageItems, totalPages, totalItems, from, to } = usePagination(recent_bookings);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-serif text-aegean-800 mb-8">Dashboard</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Awaiting payment proof review', value: stats.awaiting_payment_verification, link: '/admin/bookings' },
          { label: 'Pending bookings', value: stats.pending_bookings, link: '/admin/bookings' },
          { label: 'Confirmed stays', value: stats.confirmed_bookings },
          { label: 'Unread inquiries', value: stats.unread_inquiries, link: '/admin/inquiries' },
        ].map((s) => (
          <div key={s.label} className="bg-white p-6 rounded-xl shadow-sm">
            <p className="text-sm text-aegean-600">{s.label}</p>
            <p className="text-2xl font-serif text-aegean-800 mt-1">
              {s.link ? <Link to={s.link} className="hover:text-aegean-600">{s.value}</Link> : s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-aegean-50 rounded-xl p-6 mb-10 text-sm text-aegean-700">
        <h2 className="font-serif text-lg text-aegean-800 mb-2">QR booking workflow</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>Guest submits booking → pays and uploads proof → receives acknowledgment email</li>
          <li>Guest pays via GCash / Maya / BDO / BPI QR on confirmation page</li>
          <li>Guest uploads payment proof</li>
          <li>Admin verifies in <Link to="/admin/bookings" className="underline">Bookings</Link> → Approve</li>
          <li>Confirmation email sent to guest</li>
        </ol>
      </div>

      <h2 className="text-lg sm:text-xl font-serif mb-4">Recent Bookings</h2>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="lg:hidden divide-y divide-aegean-100">
          {pageItems.map((b) => (
            <Link
              key={b.reference_code}
              to="/admin/bookings"
              className="block p-4 hover:bg-aegean-50/80 space-y-1"
            >
              <p className="font-mono text-xs text-aegean-600">{b.reference_code}</p>
              <p className="font-medium text-aegean-900">{b.guest_name}</p>
              <p className="text-sm text-aegean-600">
                {b.room_name} · {b.check_in}
              </p>
              <p className="text-xs capitalize text-aegean-500">{b.status.replace(/_/g, ' ')}</p>
            </Link>
          ))}
        </div>
        <table className="hidden lg:table w-full text-sm">
          <thead className="bg-aegean-50 text-aegean-700">
            <tr>
              <th className="text-left p-4">Reference</th>
              <th className="text-left p-4">Guest</th>
              <th className="text-left p-4">Room</th>
              <th className="text-left p-4">Check-in</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((b) => (
              <tr key={b.reference_code} className="border-t border-aegean-100">
                <td className="p-4">
                  <Link to="/admin/bookings" className="text-aegean-600 hover:underline">
                    {b.reference_code}
                  </Link>
                </td>
                <td className="p-4">{b.guest_name}</td>
                <td className="p-4">{b.room_name}</td>
                <td className="p-4">{b.check_in}</td>
                <td className="p-4 capitalize">{b.status.replace(/_/g, ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recent_bookings.length > 0 && (
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
    </div>
  );
}
