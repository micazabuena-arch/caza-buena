import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings2, Image, CircleCheck, CircleX, X, Printer } from 'lucide-react';
import api, { getApiError } from '../api/client';
import { getAssetUrl } from '../utils/assetUrl';
import { isSeniorPassenger } from '../data/islandHoppingRates';
import PaymentWorkflowSteps from '../components/booking/PaymentWorkflowSteps';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import { useToast } from '../context/ToastContext';

const statuses = [
  'pending',
  'awaiting_payment',
  'payment_submitted',
  'confirmed',
  'rejected',
  'cancelled',
];

const statusColors = {
  awaiting_payment: 'bg-amber-100 text-amber-800',
  payment_submitted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  pending: 'bg-aegean-100 text-aegean-700',
};

function parseIslandHoppingData(detail) {
  if (!detail?.island_hopping) return null;
  try {
    const raw = detail.island_hopping_data;
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export default function AdminBookings() {
  const navigate = useNavigate();
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  // Show in-progress bookings until admin confirms or rejects
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: '', admin_notes: '', rejection_reason: '' });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [detailTab, setDetailTab] = useState('booking');

  const load = () => {
    setLoading(true);
    const params =
      filter === 'open'
        ? { open_only: '1' }
        : filter
          ? { status: filter }
          : {};
    api
      .get('/bookings/admin/all', { params })
      .then((r) => setBookings(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filter]);

  const openDetail = async (id, { silent = false } = {}) => {
    if (!silent) setActionLoading(`${id}-manage`);
    setSelected(id);
    try {
      const { data } = await api.get(`/bookings/admin/${id}`);
      setDetail(data);
      setDetailTab('booking');
      setStatusForm({
        status: data.status,
        admin_notes: data.admin_notes || '',
        rejection_reason: data.rejection_reason || '',
      });
    } catch (err) {
      toast.error(getApiError(err));
      setSelected(null);
    } finally {
      if (!silent) setActionLoading(null);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
    setDetailTab('booking');
  };

  const islandHop = detail ? parseIslandHoppingData(detail) : null;
  const roomStayTotal =
    detail && detail.island_hopping
      ? Number(detail.total_amount) - Number(detail.island_hopping_amount || 0)
      : detail
        ? Number(detail.total_amount)
        : 0;

  const saveStatus = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/bookings/admin/${selected}/status`, statusForm);
      if (data.email_sent) {
        toast.success('Booking updated. Confirmation email sent to guest.');
      } else if (statusForm.status === 'confirmed') {
        toast.success('Booking confirmed. Configure SMTP to send confirmation emails.');
      } else {
        toast.success('Booking status saved.');
      }
      load();
      await openDetail(selected, { silent: true });
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const quickApprove = async (id) => {
    setActionLoading(`${id}-approve`);
    try {
      const { data } = await api.patch(`/bookings/admin/${id}/status`, { status: 'confirmed' });
      toast.success(
        data.email_sent ? 'Booking approved. Confirmation email sent.' : 'Booking approved.'
      );
      load();
      if (selected === id) await openDetail(id, { silent: true });
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const quickReject = async (id) => {
    const reason = prompt('Rejection reason for guest:');
    if (reason === null) return;
    setActionLoading(`${id}-reject`);
    try {
      await api.patch(`/bookings/admin/${id}/status`, {
        status: 'rejected',
        rejection_reason: reason,
      });
      toast.success('Booking rejected.');
      load();
      if (selected === id) await openDetail(id, { silent: true });
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-serif text-aegean-800">Bookings</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-lg px-4 py-2 text-sm"
        >
          <option value="open">Open (not confirmed / rejected)</option>
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl p-6 mb-8 border border-aegean-100">
        <h2 className="text-sm font-medium text-aegean-700 mb-4">QR payment workflow (admin)</h2>
        <PaymentWorkflowSteps currentStep={4} />
        <p className="text-xs text-aegean-500 mt-4">
          Open bookings stay here until you <strong>confirm</strong> or <strong>reject</strong> them.
          After that, they move to <Link to="/admin/guests" className="text-aegean-600 underline">Guests</Link>.
          Use <strong>payment submitted</strong> to review proofs. Approve sends a confirmation email. Upload QR codes under{' '}
          <Link to="/admin/payments" className="text-aegean-600 underline">Payments</Link>.
        </p>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-aegean-50">
              <tr>
                <th className="text-left p-4">Reference</th>
                <th className="text-left p-4">Guest</th>
                <th className="text-left p-4">Room</th>
                <th className="text-left p-4">Dates</th>
                <th className="text-left p-4">Pay now</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-aegean-500">No bookings for this filter.</td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className={`border-t ${selected === b.id ? 'bg-aegean-50' : ''}`}>
                    <td className="p-4 font-mono text-xs">{b.reference_code}</td>
                    <td className="p-4">
                      <p>{b.guest_name}</p>
                      <p className="text-xs text-aegean-500">{b.guest_email}</p>
                    </td>
                    <td className="p-4">{b.room_name}</td>
                    <td className="p-4 whitespace-nowrap">{b.check_in} → {b.check_out}</td>
                    <td className="p-4">
                      <span className="block">₱{Number(b.amount_to_pay ?? b.total_amount).toLocaleString()} due</span>
                      {Number(b.amount_to_pay) < Number(b.total_amount) && (
                        <span className="text-xs text-aegean-500">
                          of ₱{Number(b.total_amount).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusColors[b.status] || ''}`}>
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <IconActionGroup>
                        <IconActionButton
                          icon={Settings2}
                          label="Manage booking"
                          loading={actionLoading === `${b.id}-manage`}
                          disabled={Boolean(actionLoading)}
                          onClick={() => openDetail(b.id)}
                        />
                        {b.payment_proof_url && (
                          <IconActionButton
                            icon={Image}
                            label="View payment proof"
                            href={getAssetUrl(b.payment_proof_url)}
                            target="_blank"
                            rel="noreferrer"
                          />
                        )}
                        {b.status === 'payment_submitted' && (
                          <>
                            <IconActionButton
                              icon={CircleCheck}
                              label="Approve booking"
                              loading={actionLoading === `${b.id}-approve`}
                              disabled={Boolean(actionLoading)}
                              onClick={() => quickApprove(b.id)}
                            />
                            <IconActionButton
                              icon={CircleX}
                              label="Reject booking"
                              loading={actionLoading === `${b.id}-reject`}
                              disabled={Boolean(actionLoading)}
                              onClick={() => quickReject(b.id)}
                            />
                          </>
                        )}
                      </IconActionGroup>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-serif text-aegean-800">Booking {detail.reference_code}</h2>
              <button type="button" onClick={closeDetail} className="p-1 hover:bg-aegean-50 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-1 mb-4 p-1 bg-aegean-50 rounded-lg">
              <button
                type="button"
                onClick={() => setDetailTab('booking')}
                className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
                  detailTab === 'booking'
                    ? 'bg-white text-aegean-800 font-medium shadow-sm'
                    : 'text-aegean-600 hover:text-aegean-800'
                }`}
              >
                Booking
              </button>
              {detail.island_hopping && (
                <button
                  type="button"
                  onClick={() => setDetailTab('island-hopping')}
                  className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
                    detailTab === 'island-hopping'
                      ? 'bg-white text-aegean-800 font-medium shadow-sm'
                      : 'text-aegean-600 hover:text-aegean-800'
                  }`}
                >
                  Island hopping
                </button>
              )}
            </div>

            {detailTab === 'booking' && (
              <>
                <div className="text-sm space-y-2 text-aegean-700 mb-6">
                  <p><strong>Guest:</strong> {detail.guest_name}</p>
                  {detail.guest_phone && (
                    <p><strong>Phone Number:</strong> {detail.guest_phone}</p>
                  )}
                  <p><strong>Email:</strong> {detail.guest_email}</p>
                  {detail.valid_id && <p><strong>Valid ID:</strong> {detail.valid_id}</p>}
                  {detail.estimated_arrival && (
                    <p><strong>ETA:</strong> {detail.estimated_arrival}</p>
                  )}
                  <p><strong>Room:</strong> {detail.room_name}</p>
                  <p><strong>Stay:</strong> {detail.check_in} → {detail.check_out} ({detail.nights} nights)</p>
                  <p>
                    <strong>Guests:</strong> {detail.adults ?? detail.guest_count} adult(s)
                    {(detail.children_under6 > 0 || detail.children_7_12 > 0) && (
                      <span>
                        {detail.children_under6 > 0 ? ` · ${detail.children_under6} under 6` : ''}
                        {detail.children_7_12 > 0 ? ` · ${detail.children_7_12} age 7–12` : ''}
                      </span>
                    )}
                  </p>
                  <p><strong>Room stay:</strong> ₱{roomStayTotal.toLocaleString()}</p>
                  {detail.island_hopping && (
                    <p className="text-aegean-600">
                      <strong>Island hopping:</strong> ₱
                      {Number(detail.island_hopping_amount || 0).toLocaleString()}
                      <span className="text-xs"> — see Island hopping tab</span>
                    </p>
                  )}
                  <p><strong>Booking total:</strong> ₱{Number(detail.total_amount).toLocaleString()}</p>
                  <p>
                    <strong>Amount to pay:</strong> ₱
                    {Number(detail.amount_to_pay ?? detail.total_amount).toLocaleString()}
                    {detail.payment_option && (
                      <span className="text-aegean-500 text-sm"> ({detail.payment_option})</span>
                    )}
                  </p>
                  {detail.payment_method_name && (
                    <p><strong>Payment:</strong> {detail.payment_method_name}</p>
                  )}
                  {detail.special_requests && (
                    <p><strong>Special requests:</strong> {detail.special_requests}</p>
                  )}
                </div>

                {detail.payment_proof_url && (
                  <a
                    href={getAssetUrl(detail.payment_proof_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="block mb-6 text-sm text-aegean-600 underline"
                  >
                    View payment proof →
                  </a>
                )}
              </>
            )}

            {detailTab === 'island-hopping' && islandHop && (
              <div className="text-sm space-y-4 text-aegean-700 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-aegean-800">Island hopping details</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selected) return;
                      navigate(`/admin/bookings/${selected}/print-island`);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-aegean-200 text-aegean-700 hover:bg-aegean-50"
                  >
                    <Printer size={14} /> Print manifest
                  </button>
                </div>

                <div className="rounded-lg bg-aegean-50 p-4 space-y-1">
                  <p className="font-medium text-aegean-800">Tour summary</p>
                  <p>
                    <strong>Total tour:</strong> ₱
                    {Number(detail.island_hopping_amount || islandHop.total || 0).toLocaleString()}
                  </p>
                  {islandHop.boat_label && (
                    <p><strong>Boat:</strong> {islandHop.boat_label}</p>
                  )}
                  <p><strong>Passengers:</strong> {islandHop.passengers?.length ?? 0}</p>
                </div>

                <div>
                  <p className="font-medium text-aegean-800 mb-2">Guests on tour</p>
                  <ul className="space-y-3">
                    {(islandHop.passengers || []).map((p, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-aegean-100 bg-white p-3 space-y-2"
                      >
                        <p className="font-medium">{p.full_name}</p>
                        <p className="text-xs text-aegean-600">
                          Age {p.age} · {p.gender} ·{' '}
                          {p.is_first_timer ? 'First timer' : 'Not first timer'}
                          {p.is_senior || isSeniorPassenger(p) ? ' · Senior' : ''}
                        </p>
                        {isSeniorPassenger(p) && (
                          <div className="pt-1">
                            {p.senior_id_url ? (
                              <div className="space-y-2">
                                <a
                                  href={getAssetUrl(p.senior_id_url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-aegean-600 underline inline-flex items-center gap-1"
                                >
                                  <Image size={12} /> View senior citizen ID
                                </a>
                                {!String(p.senior_id_url).toLowerCase().includes('.pdf') && (
                                  <img
                                    src={getAssetUrl(p.senior_id_url)}
                                    alt={`Senior ID — ${p.full_name}`}
                                    className="max-h-32 rounded border border-aegean-100 object-contain"
                                  />
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 inline-block">
                                Senior ID not uploaded yet
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <p>
                  <strong>Address of passengers:</strong>
                  <span className="block mt-1 text-aegean-600">{islandHop.passenger_address}</span>
                </p>

                <div className="rounded-lg border border-aegean-100 p-3 space-y-1">
                  <p className="font-medium text-aegean-800">Payor</p>
                  <p>{islandHop.payor_name}</p>
                  <p className="text-aegean-600">{islandHop.payor_address}</p>
                  <p className="text-aegean-600">{islandHop.payor_phone}</p>
                </div>

                <div className="rounded-lg border border-aegean-100 p-3 space-y-1">
                  <p className="font-medium text-aegean-800">Emergency contact (not on tour)</p>
                  <p>{islandHop.emergency_contact_name}</p>
                  <p className="text-aegean-600">{islandHop.emergency_contact_phone}</p>
                </div>

                {islandHop.breakdown?.length > 0 && (
                  <div>
                    <p className="font-medium text-aegean-800 mb-2">Fee breakdown</p>
                    <ul className="space-y-2 rounded-lg border border-aegean-100 divide-y divide-aegean-100">
                      {islandHop.breakdown.map((line, i) => (
                        <li key={i} className="flex justify-between gap-3 p-3 text-xs">
                          <span className="flex-1">{line.description}</span>
                          <span className="shrink-0 font-medium">
                            ₱{Number(line.subtotal).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4 border-t border-aegean-100 pt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Booking status</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admin notes (internal)</label>
                <textarea
                  rows={2}
                  value={statusForm.admin_notes}
                  onChange={(e) => setStatusForm((f) => ({ ...f, admin_notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {statusForm.status === 'rejected' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Rejection reason (guest)</label>
                  <textarea
                    rows={2}
                    value={statusForm.rejection_reason}
                    onChange={(e) => setStatusForm((f) => ({ ...f, rejection_reason: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              <SubmitButton
                type="button"
                onClick={saveStatus}
                loading={saving}
                loadingLabel="Saving..."
                disabled={Boolean(actionLoading)}
                className="w-full text-sm"
              >
                Save status
              </SubmitButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
