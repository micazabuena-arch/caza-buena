import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, X } from 'lucide-react';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';

const statusColors = {
  awaiting_payment: 'bg-amber-100 text-amber-800',
  payment_submitted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  pending: 'bg-aegean-100 text-aegean-700',
};

export default function AdminGuests() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ guest_name: '', guest_email: '', guest_phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const loadGuests = () => {
    setLoading(true);
    api
      .get('/admin/guests')
      .then((r) => setGuests(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadGuests();
  }, []);

  const openGuest = async (email, edit = false) => {
    setSelectedEmail(email);
    setEditing(edit);
    setError('');
    setDetailLoading(true);
    try {
      const { data } = await api.get('/admin/guests/detail', { params: { email } });
      setDetail(data);
      setForm({
        guest_name: data.guest_name,
        guest_email: data.guest_email,
        guest_phone: data.guest_phone,
      });
    } catch (err) {
      setError(getApiError(err));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closePanel = () => {
    setSelectedEmail(null);
    setDetail(null);
    setEditing(false);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/admin/guests', {
        original_email: selectedEmail,
        guest_name: form.guest_name,
        guest_email: form.guest_email,
        guest_phone: form.guest_phone,
      });
      toast.success(`Guest saved — updated ${data.bookings_updated} booking(s).`);
      loadGuests();
      const newEmail = form.guest_email.trim();
      setSelectedEmail(newEmail);
      await openGuest(newEmail, false);
      setEditing(false);
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-serif text-aegean-800 mb-2">Guests</h1>
      <p className="text-sm text-aegean-600 mb-8">
        Guests appear here only after their payment is <strong>approved</strong> or{' '}
        <strong>rejected</strong> in Bookings. Pending reviews stay under Bookings.
      </p>

      {loading ? (
        <Loading />
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-aegean-50">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Phone</th>
                <th className="text-left p-4">Bookings</th>
                <th className="text-left p-4">Last Booking</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-aegean-500">
                    No guests yet — approve or reject a payment in Bookings first.
                  </td>
                </tr>
              ) : (
                guests.map((g) => (
                  <tr key={g.guest_email} className="border-t border-aegean-100 hover:bg-aegean-50/50">
                    <td className="p-4 font-medium text-aegean-800">{g.guest_name}</td>
                    <td className="p-4 text-aegean-600">{g.guest_email}</td>
                    <td className="p-4">{g.guest_phone}</td>
                    <td className="p-4">{g.total_bookings}</td>
                    <td className="p-4">{new Date(g.last_booking).toLocaleDateString()}</td>
                    <td className="p-4 text-right">
                      <IconActionGroup className="justify-end">
                        <IconActionButton
                          icon={Eye}
                          label="View guest"
                          onClick={() => openGuest(g.guest_email, false)}
                        />
                        <IconActionButton
                          icon={Pencil}
                          label="Edit guest"
                          onClick={() => openGuest(g.guest_email, true)}
                        />
                      </IconActionGroup>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={closePanel}>
          <div
            className="w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-aegean-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-serif text-aegean-800">
                {editing ? 'Edit guest' : 'Guest details'}
              </h2>
              <button type="button" onClick={closePanel} className="p-2 hover:bg-aegean-50 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {detailLoading ? (
                <Loading />
              ) : !detail ? (
                <p className="text-red-600 text-sm">{error || 'Could not load guest.'}</p>
              ) : editing ? (
                <form onSubmit={handleSave} className="space-y-4">
                  {error && <p className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">{error}</p>}
                  <div>
                    <label className="block text-sm font-medium text-aegean-700 mb-1">Full name *</label>
                    <input
                      required
                      value={form.guest_name}
                      onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))}
                      className="w-full border border-aegean-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-aegean-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={form.guest_email}
                      onChange={(e) => setForm((f) => ({ ...f, guest_email: e.target.value }))}
                      className="w-full border border-aegean-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-aegean-700 mb-1">Phone *</label>
                    <input
                      required
                      value={form.guest_phone}
                      onChange={(e) => setForm((f) => ({ ...f, guest_phone: e.target.value }))}
                      className="w-full border border-aegean-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <p className="text-xs text-aegean-500">
                    Changes apply to all {detail.total_bookings} booking(s) for this guest.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <SubmitButton loading={saving} loadingLabel="Saving..." className="text-sm">
                      Save changes
                    </SubmitButton>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setForm({
                          guest_name: detail.guest_name,
                          guest_email: detail.guest_email,
                          guest_phone: detail.guest_phone,
                        });
                        setError('');
                      }}
                      className="btn-outline text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="space-y-3 text-sm mb-6">
                    <p>
                      <span className="text-aegean-500">Name:</span>{' '}
                      <strong className="text-aegean-800">{detail.guest_name}</strong>
                    </p>
                    <p>
                      <span className="text-aegean-500">Email:</span> {detail.guest_email}
                    </p>
                    <p>
                      <span className="text-aegean-500">Phone:</span> {detail.guest_phone}
                    </p>
                    <p>
                      <span className="text-aegean-500">Total bookings:</span> {detail.total_bookings}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="btn-outline text-sm flex items-center gap-2 mb-8"
                  >
                    <Pencil size={16} /> Edit guest
                  </button>

                  <h3 className="font-medium text-aegean-800 mb-3">Booking history</h3>
                  <ul className="space-y-3">
                    {detail.bookings.map((b) => (
                      <li key={b.id} className="border border-aegean-100 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-mono text-aegean-700 text-xs">{b.reference_code}</span>
                          <span
                            className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${
                              statusColors[b.status] || 'bg-gray-100'
                            }`}
                          >
                            {b.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-aegean-800 font-medium">{b.room_name}</p>
                        <p className="text-aegean-600 text-xs mt-1">
                          {b.check_in} → {b.check_out} · {b.nights} night(s)
                        </p>
                        <p className="text-aegean-500 text-xs mt-1">
                          ₱{Number(b.total_amount).toLocaleString()} · {b.guest_count} guest(s)
                        </p>
                        <Link
                          to="/admin/bookings"
                          className="inline-block text-xs text-aegean-500 hover:text-aegean-700 mt-2 underline"
                          onClick={closePanel}
                        >
                          Open in Bookings →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
