import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings2, Image, CircleCheck, CircleX, Printer, Plus } from 'lucide-react';
import api, { getApiError } from '../api/client';
import { getAssetUrl } from '../utils/assetUrl';
import { isSeniorPassenger, isPwdPassenger } from '../data/islandHoppingRates';
import { getBilaoPackage, getBoodlePackage } from '../data/bookingAddOns';
import { getBookingPaymentMethodLabel } from '../data/manualBookingPayment';
import PaymentWorkflowSteps from '../components/booking/PaymentWorkflowSteps';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import { formatGuestCount } from '../utils/guestCount';
import { getBookingPaymentSummary } from '../utils/bookingPayment';
import BookingDateEditor from '../components/admin/BookingDateEditor';
import AdminModal from '../components/admin/AdminModal';
import AdminBookingCard from '../components/admin/AdminBookingCard';
import ManualBookingForm from '../components/admin/ManualBookingForm';
import AdminTableShell from '../components/ui/AdminTableShell';

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

const STATUS_LABELS = {
  awaiting_payment: 'Awaiting payment',
  payment_submitted: 'Payment submitted',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  pending: 'Pending',
};

function formatStatus(status) {
  return STATUS_LABELS[status] || String(status).replace(/_/g, ' ');
}

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
  const confirm = useConfirm();
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
  const [showManualForm, setShowManualForm] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState(null);

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

  const {
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems,
    from,
    to,
  } = usePagination(bookings);

  useEffect(() => {
    setPage(1);
  }, [filter, setPage]);

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

  const openManualForm = () => setShowManualForm(true);

  const closeManualForm = () => setShowManualForm(false);

  const handleManualBookingCreated = (booking) => {
    closeManualForm();
    setFilter(booking?.status === 'confirmed' ? 'confirmed' : '');
    load();
  };

  const islandHop = detail ? parseIslandHoppingData(detail) : null;
  const roomStayTotal = detail
    ? Number(detail.total_amount) -
      Number(detail.island_hopping_amount || 0) -
      Number(detail.bilao_amount || 0) -
      Number(detail.boodle_fight_amount || 0)
    : 0;

  const saveStatus = async () => {
    const statusLabels = {
      confirmed: 'confirm this booking',
      rejected: 'reject this booking',
      cancelled: 'cancel this booking',
    };
    const action = statusLabels[statusForm.status] || 'update this booking status';
    const ok = await confirm({
      title: 'Save booking status?',
      message: `Are you sure you want to ${action}? The guest may be notified by email.`,
      confirmLabel: 'Yes, save',
      variant: statusForm.status === 'rejected' || statusForm.status === 'cancelled' ? 'danger' : 'primary',
    });
    if (!ok) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/bookings/admin/${selected}/status`, statusForm);
      if (data.email_sent) {
        toast.success('Booking updated. Confirmation email sent to guest.');
      } else if (data.email_pending && statusForm.status === 'rejected') {
        toast.success('Booking rejected. Rejection email is being sent to the guest.');
      } else if (data.email_pending && statusForm.status === 'confirmed') {
        toast.success('Booking confirmed. Confirmation email is being sent to the guest.');
      } else if (statusForm.status === 'confirmed') {
        toast.warning(
          data.email_hint ||
            'Booking confirmed, but the email was not sent. Check SMTP settings on the server.'
        );
      } else if (statusForm.status === 'rejected') {
        toast.success('Booking rejected.');
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
    const ok = await confirm({
      title: 'Approve booking?',
      message: 'This booking will be confirmed. The guest may receive a confirmation email.',
      confirmLabel: 'Yes, approve',
    });
    if (!ok) return;
    setActionLoading(`${id}-approve`);
    try {
      const { data } = await api.patch(`/bookings/admin/${id}/status`, { status: 'confirmed' });
      if (data.email_sent) {
        toast.success('Booking approved. Confirmation email sent.');
      } else if (data.email_pending) {
        toast.success('Booking approved. Confirmation email is being sent.');
      } else {
        toast.warning(
          data.email_hint ||
            'Booking approved, but the email was not sent. Check SMTP settings on Render.'
        );
      }
      load();
      if (selected === id) await openDetail(id, { silent: true });
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const quickReject = async (id) => {
    const ok = await confirm({
      title: 'Reject booking?',
      message: 'This booking will be rejected. You will be asked for a reason to share with the guest.',
      confirmLabel: 'Yes, reject',
      variant: 'danger',
    });
    if (!ok) return;
    const reason = prompt('Rejection reason for guest:');
    if (reason === null) return;
    setActionLoading(`${id}-reject`);
    try {
      const { data } = await api.patch(`/bookings/admin/${id}/status`, {
        status: 'rejected',
        rejection_reason: reason,
      });
      if (data.email_pending) {
        toast.success('Booking rejected. Rejection email is being sent to the guest.');
      } else {
        toast.success('Booking rejected.');
      }
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
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-serif text-aegean-800">Bookings</h1>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={openManualForm}
            className="btn-primary text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus size={18} /> Add manual booking
          </button>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded-lg px-4 py-2 text-sm w-full sm:w-auto"
          >
            <option value="open">Open (not confirmed / rejected)</option>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {showManualForm && (
        <AdminModal
          open={showManualForm}
          onClose={closeManualForm}
          title="Manual booking"
          description="Walk-ins, phone, or social media. Confirmed blocks the room on the site."
          size="xl"
          padding={false}
          bodyClassName="p-6"
        >
          <ManualBookingForm onSuccess={handleManualBookingCreated} onCancel={closeManualForm} />
        </AdminModal>
      )}

      <div className="bg-white rounded-xl p-6 mb-8 border border-aegean-100">
        <h2 className="text-sm font-medium text-aegean-700 mb-4">QR payment workflow (admin)</h2>
        <PaymentWorkflowSteps currentStep={4} />
        <p className="text-xs text-aegean-500 mt-4">
          Use <strong>Add manual booking</strong> for walk-ins or phone reservations — confirmed stays
          block dates on the website. Online reviews: confirm, reject, or cancel here. Full guest history is under{' '}
          <Link to="/admin/guests" className="text-aegean-600 underline">Guests</Link>.
          Use <strong>payment submitted</strong> to review proofs. Approve sends a confirmation email. Upload QR codes under{' '}
          <Link to="/admin/payments" className="text-aegean-600 underline">Payments</Link>.
        </p>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="bg-white rounded-xl shadow-sm">
          {bookings.length === 0 ? (
            <p className="p-8 text-center text-aegean-500">No bookings for this filter.</p>
          ) : (
            <div className="lg:hidden p-4 space-y-3">
              {pageItems.map((b) => (
                <AdminBookingCard
                  key={b.id}
                  booking={b}
                  selected={selected === b.id}
                  statusColors={statusColors}
                  formatStatus={formatStatus}
                  formatGuestCount={formatGuestCount}
                  paySubtext={
                    Number(b.amount_to_pay) < Number(b.total_amount) ? (
                      <span className="text-xs text-aegean-500 block mt-0.5">
                        of ₱{Number(b.total_amount).toLocaleString()}
                      </span>
                    ) : null
                  }
                  actions={
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
                          onClick={() => setPaymentProofUrl(getAssetUrl(b.payment_proof_url))}
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
                  }
                />
              ))}
            </div>
          )}

          <AdminTableShell>
            <thead className="bg-aegean-50">
              <tr>
                <th className="text-left p-4">Reference</th>
                <th className="text-left p-4">Guest</th>
                <th className="text-left p-4">Guests</th>
                <th className="text-left p-4">Room</th>
                <th className="text-left p-4">Dates</th>
                <th className="text-left p-4">Pay now</th>
                <th className="text-left p-4 whitespace-nowrap">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length > 0 &&
                pageItems.map((b) => (
                  <tr key={b.id} className={`border-t ${selected === b.id ? 'bg-aegean-50' : ''}`}>
                    <td className="p-4 font-mono text-xs">{b.reference_code}</td>
                    <td className="p-4">
                      <p>{b.guest_name}</p>
                      <p className="text-xs text-aegean-500">{b.guest_email}</p>
                    </td>
                    <td className="p-4 text-aegean-700 whitespace-nowrap">{formatGuestCount(b)}</td>
                    <td className="p-4">{b.room_names || b.room_name}</td>
                    <td className="p-4 whitespace-nowrap">{b.check_in} → {b.check_out}</td>
                    <td className="p-4">
                      <span className="block">₱{Number(b.amount_to_pay ?? b.total_amount).toLocaleString()} due</span>
                      {Number(b.amount_to_pay) < Number(b.total_amount) && (
                        <span className="text-xs text-aegean-500">
                          of ₱{Number(b.total_amount).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                          statusColors[b.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {formatStatus(b.status)}
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
                            onClick={() => setPaymentProofUrl(getAssetUrl(b.payment_proof_url))}
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
                ))}
            </tbody>
          </AdminTableShell>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            from={from}
            to={to}
            onPageChange={setPage}
          />
        </div>
      )}

      {detail && (
        <AdminModal
          open={Boolean(detail)}
          onClose={closeDetail}
          title={`Booking ${detail.reference_code}`}
          size="md"
        >
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
              {Boolean(detail.island_hopping) && (
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
                  <p>
                    <strong>{detail.room_count > 1 ? 'Rooms' : 'Room'}:</strong>{' '}
                    {detail.room_lines?.length
                      ? detail.room_lines.map((line) => line.room_name).join(', ')
                      : detail.room_names || detail.room_name}
                  </p>
                  <p><strong>Stay:</strong> {detail.check_in} → {detail.check_out} ({detail.nights} nights)</p>
                  <BookingDateEditor
                    booking={detail}
                    onSaved={(updated) => {
                      setDetail(updated);
                      load();
                    }}
                  />
                  <p><strong>Guests:</strong> {formatGuestCount(detail)}</p>
                  <p><strong>Room stay:</strong> ₱{roomStayTotal.toLocaleString()}</p>
                  {Boolean(detail.island_hopping) && (
                    <p className="text-aegean-600">
                      <strong>Island hopping:</strong> ₱
                      {Number(detail.island_hopping_amount || 0).toLocaleString()}
                      <span className="text-xs"> — see Island hopping tab</span>
                    </p>
                  )}
                  {detail.bringing_car ? (
                    <p>
                      <strong>Car:</strong> {detail.car_count || 1} car
                      {(detail.car_count || 1) !== 1 ? 's' : ''}
                    </p>
                  ) : (
                    <p><strong>Car:</strong> None</p>
                  )}
                  {Number(detail.pet_count) > 0 && (
                    <p>
                      <strong>Pets:</strong> {detail.pet_count} · deposit ₱
                      {Number(detail.pet_deposit_amount || 0).toLocaleString()} (refundable)
                    </p>
                  )}
                  {detail.bilao_package && (
                    <p>
                      <strong>Bilao:</strong>{' '}
                      {getBilaoPackage(detail.bilao_package)?.label || detail.bilao_package} — ₱
                      {Number(detail.bilao_amount || 0).toLocaleString()}
                    </p>
                  )}
                  {detail.boodle_fight && (
                    <p>
                      <strong>Boodle fight:</strong>{' '}
                      {getBoodlePackage(detail.boodle_fight_tier)?.label || detail.boodle_fight_tier}{' '}
                      — ₱{Number(detail.boodle_fight_amount || 0).toLocaleString()}
                    </p>
                  )}
                  {(() => {
                    const pay = getBookingPaymentSummary(detail);
                    return (
                      <>
                        <p><strong>Booking total:</strong> ₱{pay.total.toLocaleString()}</p>
                        <p>
                          <strong>{pay.upfrontLabel}:</strong> ₱{pay.payNow.toLocaleString()}
                          {pay.paymentOptionLabel && (
                            <span className="text-aegean-500 text-sm"> ({pay.paymentOptionLabel})</span>
                          )}
                        </p>
                        {pay.isPartial && (
                          <p><strong>Balance due:</strong> ₱{pay.balance.toLocaleString()}</p>
                        )}
                      </>
                    );
                  })()}
                  {getBookingPaymentMethodLabel(detail) && (
                    <p><strong>Payment:</strong> {getBookingPaymentMethodLabel(detail)}</p>
                  )}
                  {detail.special_requests && (
                    <p><strong>Special requests:</strong> {detail.special_requests}</p>
                  )}
                </div>

                {detail.payment_proof_url && (
                  <button
                    type="button"
                    onClick={() => setPaymentProofUrl(getAssetUrl(detail.payment_proof_url))}
                    className="block mb-6 text-sm text-aegean-600 underline text-left hover:text-aegean-800"
                  >
                    View payment proof →
                  </button>
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
                          {isPwdPassenger(p) ? ' · PWD' : ''}
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
                        {isPwdPassenger(p) && (
                          <div className="pt-1">
                            {p.pwd_id_url ? (
                              <div className="space-y-2">
                                <a
                                  href={getAssetUrl(p.pwd_id_url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-aegean-600 underline inline-flex items-center gap-1"
                                >
                                  <Image size={12} /> View PWD ID
                                </a>
                                {!String(p.pwd_id_url).toLowerCase().includes('.pdf') && (
                                  <img
                                    src={getAssetUrl(p.pwd_id_url)}
                                    alt={`PWD ID — ${p.full_name}`}
                                    className="max-h-32 rounded border border-aegean-100 object-contain"
                                  />
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 inline-block">
                                PWD ID not uploaded yet
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
        </AdminModal>
      )}

      <AdminModal
        open={Boolean(paymentProofUrl)}
        onClose={() => setPaymentProofUrl(null)}
        title="Payment proof"
        size="md"
      >
        {paymentProofUrl && (
          <div className="space-y-4">
            {String(paymentProofUrl).toLowerCase().includes('.pdf') ? (
              <>
                <p className="text-sm text-aegean-600">PDF document uploaded by the guest.</p>
                <a
                  href={paymentProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline text-sm inline-block"
                >
                  Open PDF in new tab
                </a>
                <iframe
                  src={paymentProofUrl}
                  title="Payment proof"
                  className="w-full h-[60vh] rounded-lg border border-aegean-100"
                />
              </>
            ) : (
              <img
                src={paymentProofUrl}
                alt="Payment proof"
                className="w-full max-h-[70vh] object-contain rounded-lg border border-aegean-100"
              />
            )}
          </div>
        )}
      </AdminModal>
    </div>
  );
}
