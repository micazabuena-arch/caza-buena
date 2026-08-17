import { useEffect, useState } from 'react';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Pagination from '../components/ui/Pagination';
import AdminListFilters from '../components/ui/AdminListFilters';
import { useFilteredPagination } from '../hooks/useAdminListFilter';
import { toDateKey } from '../utils/adminListFilter';
import { useDirtySnapshot, useUnsavedNavigation } from '../hooks/useConfirmLeave';

function blockStartDate(item) {
  return toDateKey(item.start_date);
}

const BLOCK_SEARCH_FIELDS = ['reason', 'start_date', 'end_date'];

export default function AdminAvailability() {
  const [rooms, setRooms] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
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
  } = useFilteredPagination(blocks, {
    searchFields: BLOCK_SEARCH_FIELDS,
    getDate: blockStartDate,
  }, roomId);
  const [availabilityBaselineKey, setAvailabilityBaselineKey] = useState(0);
  const availabilityDirty = useDirtySnapshot(form, true, availabilityBaselineKey);
  useUnsavedNavigation(availabilityDirty);

  useEffect(() => {
    api.get('/rooms/admin/all').then((r) => {
      setRooms(r.data);
      if (r.data[0]) setRoomId(String(r.data[0].id));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!roomId) return;
    setPage(1);
    api.get(`/admin/availability/${roomId}`).then((r) => setBlocks(r.data));
  }, [roomId, setPage]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Block dates?',
      message: 'These dates will be unavailable for new bookings on the selected room.',
      confirmLabel: 'Yes, block dates',
    });
    if (!ok) return;
    setError('');
    setSubmitting(true);
    try {
      await api.post('/admin/availability', { room_id: parseInt(roomId, 10), ...form });
      setForm({ start_date: '', end_date: '', reason: '' });
      setAvailabilityBaselineKey((n) => n + 1);
      const { data } = await api.get(`/admin/availability/${roomId}`);
      setBlocks(data);
      toast.success('Dates blocked.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    const ok = await confirm({
      title: 'Remove block?',
      message: 'These dates will become available for booking again.',
      confirmLabel: 'Yes, remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/availability/${id}`);
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      toast.success('Block removed.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-3xl font-serif text-aegean-800 mb-8">Room Availability</h1>
      <p className="text-aegean-600 text-sm mb-6">Block dates when rooms are unavailable for maintenance or private events.</p>

      <select
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        className="border rounded-lg px-4 py-2 mb-6"
      >
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl shadow-sm mb-8 grid sm:grid-cols-4 gap-4 items-end">
        {error && <p className="sm:col-span-4 text-red-600 text-sm">{error}</p>}
        <input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="border rounded-lg px-3 py-2" />
        <input type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="border rounded-lg px-3 py-2" />
        <input placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="border rounded-lg px-3 py-2" />
        <SubmitButton loading={submitting} loadingLabel="Blocking..." className="text-sm">
          Block Dates
        </SubmitButton>
      </form>

      {blocks.length > 0 && (
        <AdminListFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search reason or dates…"
          showDates
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          dateFromLabel="Starts from"
          dateToLabel="Starts to"
        />
      )}

      <div className="space-y-3">
        {blocks.length === 0 ? (
          <p className="text-aegean-600">No blocked dates for this room.</p>
        ) : filtered.length === 0 ? (
          <p className="text-aegean-600">No blocked dates match this filter.</p>
        ) : (
          pageItems.map((b) => (
            <div key={b.id} className="bg-white p-4 rounded-xl flex justify-between items-center">
              <span>{b.start_date} → {b.end_date} {b.reason && `· ${b.reason}`}</span>
              <button type="button" onClick={() => remove(b.id)} className="text-red-600 text-sm">Remove</button>
            </div>
          ))
        )}
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
    </div>
  );
}
