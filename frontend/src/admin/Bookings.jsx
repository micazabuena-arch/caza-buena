import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Settings2, Image, CircleCheck, CircleX, Printer, Plus, Trash2 } from 'lucide-react';
import api, { getApiError } from '../api/client';
import { getAssetUrl } from '../utils/assetUrl';
import { isSeniorPassenger, isPwdPassenger } from '../data/islandHoppingRates';
import { describeBilaoBooking, describeBoodleBooking } from '../data/bookingAddOns';
import { getBookingPaymentMethodLabel } from '../data/manualBookingPayment';
import PaymentWorkflowSteps from '../components/booking/PaymentWorkflowSteps';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useDirtySnapshot } from '../hooks/useConfirmLeave';
import Pagination from '../components/ui/Pagination';
import AdminListFilters from '../components/ui/AdminListFilters';
import { useFilteredPagination } from '../hooks/useAdminListFilter';
import { formatGuestCount } from '../utils/guestCount';
import { STAY_SEARCH_FIELDS, getStayCheckIn } from '../utils/adminListFilter';
import { getBookingPaymentSummary } from '../utils/bookingPayment';
import BookingDateEditor from '../components/admin/BookingDateEditor';
import AdminModal from '../components/admin/AdminModal';
import AdminBookingCard from '../components/admin/AdminBookingCard';
import ManualBookingForm from '../components/admin/ManualBookingForm';
import AdminTableShell from '../components/ui/AdminTableShell';
import BookingRoomsCell, { BookingStatusBadges } from '../components/admin/BookingRoomsCell';
import { openBookingSoaPrint } from '../utils/openBookingSoaPrint';
import { SOA_DOCUMENT_TYPES } from '../utils/soaDocumentTitle';
import { isBookingStayPast } from '../utils/bookingListDisplay';

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
  const location = useLocation();
  const toast = useToast();
  const confirm = useConfirm();
  const [bookings, setBookings] = useState([]);
  // Show in-progress bookings until admin confirms or rejects
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [statusForm, setStatusForm] = useState({
    status: '',
    admin_notes: '',
    rejection_reason: '',
    send_confirmation_email: false,
  });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [detailTab, setDetailTab] = useState('booking');
  const [showManualForm, setShowManualForm] = useState(false);
  const [quotationSeed, setQuotationSeed] = useState(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState(null);
  // Stay timeline filter (independent of payment/booking status).
  const [stayScope, setStayScope] = useState('all');

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

  useEffect(() => {
    const seed = location.state?.fromQuotation;
    if (!seed) return;
    setQuotationSeed(seed);
    setShowManualForm(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const stayScopedBookings = bookings.filter((b) => {
    if (stayScope === 'past') return isBookingStayPast(b);
    if (stayScope === 'upcoming') return !isBookingStayPast(b);
    return true;
  });

  // Status dropdown still loads from the API; search + check-in dates filter the current result set.
  const {
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    filtered,
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems,
    from,
    to,
  } = useFilteredPagination(
    stayScopedBookings,
    {
      searchFields: STAY_SEARCH_FIELDS,
      getDate: getStayCheckIn,
    },
    `${filter}|${stayScope}`
  );

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
        send_confirmation_email: data.status !== 'confirmed',
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

  const closeManualForm = () => {
    setShowManualForm(false);
    setQuotationSeed(null);
  };

  const handleManualBookingCreated = (booking) => {
    closeManualForm();
    setFilter(booking?.status === 'confirmed' ? 'confirmed' : '');
    load();
  };

  const islandHop = detail ? parseIslandHoppingData(detail) : null;
  const statusDirty = useDirtySnapshot(
    statusForm,
    Boolean(detail),
    detail?.id || 0
  );
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
    const willEmail =
      statusForm.status === 'confirmed' && statusForm.send_confirmation_email;
    const ok = await confirm({
      title: 'Save booking status?',
      message: willEmail
        ? `Are you sure you want to ${action}? A confirmation email will be sent to the guest.`
        : `Are you sure you want to ${action}?`,
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
      } else if (statusForm.status === 'confirmed' && statusForm.send_confirmation_email) {
        toast.warning(
          data.email_hint ||
            'Booking confirmed, but the email was not sent. Check SMTP settings on the server.'
        );
      } else if (statusForm.status === 'confirmed') {
        toast.success('Booking confirmed. No confirmation email was sent.');
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
      const { data } = await api.patch(`/bookings/admin/${id}/status`, {
        status: 'confirmed',
        send_confirmation_email: true,
      });
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

  const deleteBooking = async (booking) => {
    const ok = await confirm({
      title: 'Delete booking?',
      message: `"${booking.reference_code}" for ${booking.guest_name} will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Yes, delete',
      variant: 'danger',
    });
    if (!ok) return;

    setActionLoading(`${booking.id}-delete`);
    try {
      await api.delete(`/bookings/admin/${booking.id}`);
      toast.success('Booking deleted.');
      if (selected === booking.id) closeDetail();
      load();
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
          <select
            value={stayScope}
            onChange={(e) => setStayScope(e.target.value)}
            className="border rounded-lg px-4 py-2 text-sm w-full sm:w-auto"
            title="Filter by whether the stay dates have ended"
          >
            <option value="all">All stays</option>
            <option value="upcoming">Current & upcoming</option>
            <option value="past">Past stays</option>
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
          <ManualBookingForm
            quotationSeed={quotationSeed}
            onSuccess={handleManualBookingCreated}
            onCancel={closeManualForm}
          />
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

      <AdminListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, reference, room, email, phone…"
        showDates
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      {loading ? (
        <Loading />
      ) : (
        <div className="bg-white rounded-xl shadow-sm">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-aegean-500">
              {bookings.length === 0 ? 'No bookings for this status.' : 'No bookings match this search.'}
            </p>
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
                  statusBadge={
                    <BookingStatusBadges
                      booking={b}
                      statusColors={statusColors}
                      formatStatus={formatStatus}
                    />
                  }
                  roomsCell={<BookingRoomsCell booking={b} />}
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
                      <IconActionButton
                        icon={Trash2}
                        label="Delete booking"
                        loading={actionLoading === `${b.id}-delete`}
                        disabled={Boolean(actionLoading)}
                        className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                        onClick={() => deleteBooking(b)}
                      />
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
              {filtered.length > 0 &&
                pageItems.map((b) => (
                  <tr key={b.id} className={`border-t ${selected === b.id ? 'bg-aegean-50' : ''}`}>
                    <td className="p-4 font-mono text-xs">{b.reference_code}</td>
                    <td className="p-4">
                      <p>{b.guest_name}</p>
                      <p className="text-xs text-aegean-500">{b.guest_email}</p>
                    </td>
                    <td className="p-4 text-aegean-700 whitespace-nowrap">{formatGuestCount(b)}</td>
                    <td className="p-4">
                      <BookingRoomsCell booking={b} />
                    </td>
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
                      <BookingStatusBadges
                        booking={b}
                        statusColors={statusColors}
                        formatStatus={formatStatus}
                      />
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
                        <IconActionButton
                          icon={Trash2}
                          label="Delete booking"
                          loading={actionLoading === `${b.id}-delete`}
                          disabled={Boolean(actionLoading)}
                          className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                          onClick={() => deleteBooking(b)}
                        />
                      </IconActionGroup>
                    </td>
                  </tr>
                ))}
            </tbody>
          </AdminTableShell>
          {filtered.length > 0 && (
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
      )}

      {detail && (
        <AdminModal
          open={Boolean(detail)}
          onClose={closeDetail}
          isDirty={statusDirty}
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
                  {describeBilaoBooking(detail) && (
                    <p>
                      <strong>Bilao:</strong> {describeBilaoBooking(detail).label} — ₱
                      {describeBilaoBooking(detail).amount.toLocaleString()}
                    </p>
                  )}
                  {describeBoodleBooking(detail) && (
                    <p>
                      <strong>Boodle fight:</strong> {describeBoodleBooking(detail).label} — ₱
                      {describeBoodleBooking(detail).amount.toLocaleString()}
                    </p>
                  )}
                  {(() => {
                    const pay = getBookingPaymentSummary(detail);
                    return (
                      <>
                        <p><strong>Booking total:</strong> ₱{pay.total.toLocaleString()}</p>
                        {pay.paymentLines?.length > 0 ? (
                          <>
                            {pay.paymentLines.map((line) => (
                              <p key={line.id || `${line.label}-${line.amount}`}>
                                <strong>{line.label}:</strong> ₱{line.amount.toLocaleString()}
                              </p>
                            ))}
                            <p>
                              <strong>Total amount paid:</strong> ₱{pay.payNow.toLocaleString()}
                            </p>
                          </>
                        ) : (
                          <p>
                            <strong>{pay.upfrontLabel}:</strong> ₱{pay.payNow.toLocaleString()}
                            {pay.paymentOptionLabel && (
                              <span className="text-aegean-500 text-sm"> ({pay.paymentOptionLabel})</span>
                            )}
                          </p>
                        )}
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
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      openBookingSoaPrint(detail.id, 'soa');
                    } catch (err) {
                      toast.error(err.message || 'Could not open printable statement of account.');
                    }
                  }}
                  className="btn-outline text-sm inline-flex items-center gap-2"
                >
                  <Printer size={16} /> {SOA_DOCUMENT_TYPES.soa.printLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      openBookingSoaPrint(detail.id, 'confirmation');
                    } catch (err) {
                      toast.error(err.message || 'Could not open printable confirmation.');
                    }
                  }}
                  className="btn-outline text-sm inline-flex items-center gap-2"
                >
                  <Printer size={16} /> {SOA_DOCUMENT_TYPES.confirmation.printLabel}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Booking status</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStatusForm((f) => ({
                      ...f,
                      status: next,
                      send_confirmation_email:
                        next === 'confirmed' && detail.status !== 'confirmed'
                          ? true
                          : f.send_confirmation_email,
                    }));
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              {statusForm.status === 'confirmed' && (
                <label className="flex items-start gap-2 text-sm text-aegean-700">
                  <input
                    type="checkbox"
                    checked={Boolean(statusForm.send_confirmation_email)}
                    onChange={(e) =>
                      setStatusForm((f) => ({ ...f, send_confirmation_email: e.target.checked }))
                    }
                    className="mt-0.5 rounded"
                  />
                  <span>
                    Send confirmation email to guest
                    {detail.status === 'confirmed' ? (
                      <span className="block text-xs text-aegean-500 mt-0.5">
                        Check this to send (or resend) the confirmation now. Saving without it will
                        not email the guest.
                      </span>
                    ) : (
                      <span className="block text-xs text-aegean-500 mt-0.5">
                        Uncheck if you want to confirm now and email the guest later.
                      </span>
                    )}
                    {!detail.guest_email && (
                      <span className="block text-xs text-red-600 mt-0.5">
                        Add a guest email on the stay first — there is no address to send to.
                      </span>
                    )}
                  </span>
                </label>
              )}
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
