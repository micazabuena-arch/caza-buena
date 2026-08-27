import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Download, Trash2 } from 'lucide-react';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import Pagination from '../components/ui/Pagination';
import AdminListFilters from '../components/ui/AdminListFilters';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { isTodayPHT } from '../utils/datetime';
import { useFilteredPagination } from '../hooks/useAdminListFilter';
import { formatGuestCount } from '../utils/guestCount';
import {
  BOOKING_STATUS_FILTER_OPTIONS,
  STAY_SEARCH_FIELDS,
  getStayCheckIn,
} from '../utils/adminListFilter';
import BookingStayDetails from '../components/admin/BookingStayDetails';
import BookingStayEditForm from '../components/admin/BookingStayEditForm';
import AdminModal from '../components/admin/AdminModal';
import AdminBookingCard from '../components/admin/AdminBookingCard';
import AdminTableShell from '../components/ui/AdminTableShell';
import BookingRoomsCell, { BookingStatusBadges } from '../components/admin/BookingRoomsCell';
import { exportGuestBookingsExcel } from '../utils/guestExport';
import { formatMoney } from '../utils/money';

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
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

function formatReference(code) {
  if (!code) return '';
  const parts = String(code).split('-');
  if (parts.length >= 3) {
    return `${parts[0]} - ${parts[1]} - ${parts[2]}`;
  }
  return code;
}

const TODAY_FILTERS = {
  all: 'All stays',
  arriving: 'Arriving today',
  departing: 'Departing today',
};

function sortByEarliestCheckIn(list) {
  return [...(list || [])].sort((a, b) => {
    const aIn = String(a.check_in || '').slice(0, 10);
    const bIn = String(b.check_in || '').slice(0, 10);
    if (aIn !== bIn) return aIn.localeCompare(bIn);
    return String(a.check_out || '').slice(0, 10).localeCompare(String(b.check_out || '').slice(0, 10));
  });
}

export default function AdminGuests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dayFilter = searchParams.get('filter') || 'all';
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [panelMode, setPanelMode] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState(null);
  const [dayCounts, setDayCounts] = useState({ check_ins_today: 0, check_outs_today: 0 });
  const toast = useToast();
  const confirm = useConfirm();

  // Today chips (arriving/departing) stack on top of search / date / status filters.
  const extraFilter = useCallback(
    (b) => {
      if (dayFilter === 'arriving') return isTodayPHT(b.check_in);
      if (dayFilter === 'departing') return isTodayPHT(b.check_out);
      return true;
    },
    [dayFilter]
  );

  const {
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    status,
    setStatus,
    filtered: filteredBookings,
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems,
    from,
    to,
  } = useFilteredPagination(
    bookings,
    {
      searchFields: STAY_SEARCH_FIELDS,
      getDate: getStayCheckIn,
      extraFilter,
    },
    dayFilter
  );

  const loadBookings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bookings/admin/all');
      setBookings(sortByEarliestCheckIn(data));
      return data;
    } catch (err) {
      toast.error(getApiError(err));
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    api
      .get('/admin/guests/daily-counts')
      .then((r) => setDayCounts(r.data))
      .catch(() => {});
  }, []);

  const fetchBookingDetail = async (id) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/bookings/admin/${id}`);
      setSelected(data);
      return data;
    } catch (err) {
      toast.error(getApiError(err));
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  const openView = async (booking) => {
    setPanelMode('view');
    setSelected(booking);
    await fetchBookingDetail(booking.id);
  };

  const openEdit = async (booking) => {
    setPanelMode('edit');
    setSelected(booking);
    await fetchBookingDetail(booking.id);
  };

  const closePanel = () => {
    setSelected(null);
    setPanelMode(null);
    setDetailLoading(false);
  };

  const handleSaved = async (updated) => {
    setSelected(updated);
    await loadBookings();
  };

  const handleExport = () => {
    const result = exportGuestBookingsExcel(filteredBookings);
    if (result.ok) {
      toast.success(`Exported ${result.count} guest stay(s) to Excel.`);
    } else {
      toast.error(result.reason);
    }
  };

  const deleteBooking = async (booking) => {
    const ok = await confirm({
      title: 'Delete booking?',
      message: `"${formatReference(booking.reference_code)}" for ${booking.guest_name} will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Yes, delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/bookings/admin/${booking.id}`);
      toast.success('Booking deleted.');
      if (selected?.id === booking.id) closePanel();
      await loadBookings();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4 mb-2">
        <h1 className="text-2xl sm:text-3xl font-serif text-aegean-800">Guests</h1>
        <button
          type="button"
          onClick={() => handleExport()}
          disabled={loading || filteredBookings.length === 0}
          className="btn-outline text-sm flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
        >
          <Download size={16} />
          Export Excel
        </button>
      </div>
      <p className="text-sm text-aegean-600 mb-4">
        Each row is one stay. Export Excel uses the current search and filters.
      </p>

      <div className="mb-6 rounded-xl border border-aegean-200 bg-white px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="text-sm font-medium text-aegean-800">Today</p>
        <p className="text-sm text-aegean-700">
          <span className="font-semibold text-aegean-900">{dayCounts.check_ins_today}</span> checking in
        </p>
        <p className="text-sm text-aegean-700">
          <span className="font-semibold text-aegean-900">{dayCounts.check_outs_today}</span> checking out
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
        status={status}
        onStatusChange={setStatus}
        statusOptions={BOOKING_STATUS_FILTER_OPTIONS}
      >
        <div className="flex flex-wrap gap-2">
          {Object.entries(TODAY_FILTERS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === 'all') {
                  setSearchParams({});
                } else {
                  setSearchParams({ filter: key });
                }
              }}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                dayFilter === key
                  ? 'bg-aegean-600 text-white border-aegean-600'
                  : 'bg-white text-aegean-700 border-aegean-200 hover:border-aegean-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </AdminListFilters>

      {loading ? (
        <Loading />
      ) : (
        <div className="bg-white rounded-xl shadow-sm">
          {filteredBookings.length === 0 ? (
            <p className="p-8 text-center text-aegean-500">
              {bookings.length === 0 ? 'No guest bookings yet.' : 'No stays match this filter.'}
            </p>
          ) : (
            <div className="lg:hidden p-4 space-y-3">
              {pageItems.map((b) => (
                <AdminBookingCard
                  key={b.id}
                  booking={{ ...b, reference_code: formatReference(b.reference_code) }}
                  selected={selected?.id === b.id}
                  statusColors={statusColors}
                  formatStatus={formatStatus}
                  formatGuestCount={formatGuestCount}
                  payLabel="Total"
                  payAmount={Number(b.total_amount)}
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
                      <IconActionButton icon={Eye} label="View stay" onClick={() => openView(b)} />
                      <IconActionButton icon={Pencil} label="Edit stay" onClick={() => openEdit(b)} />
                      <IconActionButton
                        icon={Trash2}
                        label="Delete booking"
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
                <th className="text-left p-4">Total</th>
                <th className="text-left p-4 whitespace-nowrap">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length > 0 &&
                pageItems.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-t ${selected?.id === b.id ? 'bg-aegean-50' : ''}`}
                  >
                    <td className="p-4 font-mono text-xs">{formatReference(b.reference_code)}</td>
                    <td className="p-4">
                      <p className="font-medium text-aegean-900">{b.guest_name}</p>
                      <p className="text-xs text-aegean-500">{b.guest_email}</p>
                    </td>
                    <td className="p-4 text-aegean-700 whitespace-nowrap">{formatGuestCount(b)}</td>
                    <td className="p-4">
                      <BookingRoomsCell booking={b} />
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {b.check_in} → {b.check_out}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      ₱{formatMoney(b.total_amount)}
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
                        <IconActionButton icon={Eye} label="View stay" onClick={() => openView(b)} />
                        <IconActionButton icon={Pencil} label="Edit stay" onClick={() => openEdit(b)} />
                        <IconActionButton
                          icon={Trash2}
                          label="Delete booking"
                          className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                          onClick={() => deleteBooking(b)}
                        />
                      </IconActionGroup>
                    </td>
                  </tr>
                ))}
            </tbody>
          </AdminTableShell>
          {filteredBookings.length > 0 && (
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

      <AdminModal
        open={Boolean(selected && panelMode)}
        onClose={closePanel}
        title={panelMode === 'edit' ? 'Edit stay' : 'Stay details'}
        description={
          selected
            ? `${formatReference(selected.reference_code)} · ${formatStatus(selected.status)} · ${selected.room_name} · ₱${formatMoney(selected.total_amount)}`
            : undefined
        }
        size="xl"
        bodyScroll={panelMode !== 'edit'}
        padding={panelMode !== 'edit'}
      >
        {selected && panelMode && (
          <>
            {detailLoading ? (
              <Loading />
            ) : panelMode === 'view' ? (
              <BookingStayDetails
                booking={selected}
                onViewPaymentProof={setPaymentProofUrl}
                onEdit={() => openEdit(selected)}
              />
            ) : (
              <BookingStayEditForm
                booking={selected}
                onSaved={handleSaved}
                onCancel={closePanel}
              />
            )}
          </>
        )}
      </AdminModal>

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
