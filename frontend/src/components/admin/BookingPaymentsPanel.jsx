import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api, { getApiError } from '../../api/client';
import { formatMoney } from '../../utils/money';
import { paymentTypeLabel } from '../../utils/bookingPayment';
import { useToast } from '../../context/ToastContext';
import IconActionButton from '../ui/IconActionButton';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

const PAYMENT_TYPE_OPTIONS = [
  { id: 'deposit', label: 'Down payment' },
  { id: 'partial', label: 'Partial payment' },
  { id: 'full', label: 'Full payment' },
  { id: 'custom', label: 'Custom payment' },
];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(value) {
  if (!value) return todayInputValue();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayInputValue();
  return d.toISOString().slice(0, 10);
}

function emptyForm(balanceDue = 0) {
  return {
    payment_type: balanceDue > 0 ? 'partial' : 'full',
    amount: balanceDue > 0 ? String(balanceDue) : '',
    note: '',
    paid_at: todayInputValue(),
  };
}

function PaymentFormFields({ editForm, setEditForm }) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-aegean-600 mb-1">Type *</span>
          <select
            value={editForm.payment_type}
            onChange={(e) => setEditForm((f) => ({ ...f, payment_type: e.target.value }))}
            className={inputClass}
          >
            {PAYMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-aegean-600 mb-1">Amount (₱) *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={editForm.amount}
            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
            className={inputClass}
            placeholder="0.00"
          />
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-aegean-600 mb-1">Date paid</span>
          <input
            type="date"
            value={editForm.paid_at}
            onChange={(e) => setEditForm((f) => ({ ...f, paid_at: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-aegean-600 mb-1">Note (optional)</span>
          <input
            type="text"
            value={editForm.note}
            onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
            className={inputClass}
            placeholder="e.g. GCash reference"
          />
        </label>
      </div>
    </div>
  );
}

/**
 * Records stay payments as a series (DP → partial → full) so SOA keeps every line.
 * Saves immediately via API — independent of the Edit stay form submit.
 */
export default function BookingPaymentsPanel({
  bookingId,
  payments = [],
  bookingTotal = 0,
  onChange,
  onBookingUpdated,
}) {
  const [localPayments, setLocalPayments] = useState(() =>
    Array.isArray(payments) ? payments : []
  );
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editForm, setEditForm] = useState(() => emptyForm());
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const paidTotal = localPayments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const balanceDue = Math.max(0, Math.round((Number(bookingTotal) - paidTotal) * 100) / 100);

  const syncList = useCallback(
    (next) => {
      setLocalPayments(next);
      onChange?.(next);
    },
    [onChange]
  );

  useEffect(() => {
    if (!bookingId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(`/booking-payments/booking/${bookingId}`);
        if (!cancelled) syncList(data || []);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load payments:', err);
          if (Array.isArray(payments) && payments.length > 0) {
            setLocalPayments(payments);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when booking changes
  }, [bookingId]);

  const startAdd = () => {
    setEditingId(null);
    setAdding(true);
    setEditForm(emptyForm(balanceDue));
  };

  const startEdit = (row) => {
    setAdding(false);
    setEditingId(row.id);
    setEditForm({
      payment_type: row.payment_type || 'custom',
      amount: String(row.amount ?? ''),
      note: row.note || '',
      paid_at: toDateInputValue(row.paid_at),
    });
  };

  const cancelEdit = () => {
    setAdding(false);
    setEditingId(null);
    setEditForm(emptyForm(balanceDue));
  };

  const handleSave = async () => {
    const amount = parseFloat(editForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        payment_type: editForm.payment_type,
        amount,
        note: editForm.note.trim() || null,
        paid_at: editForm.paid_at || undefined,
      };

      let booking;
      if (adding) {
        const { data } = await api.post(`/booking-payments/booking/${bookingId}`, payload);
        booking = data.booking;
        syncList(booking?.payments || [...localPayments, data]);
      } else if (editingId) {
        const { data } = await api.put(`/booking-payments/${editingId}`, payload);
        booking = data.booking;
        syncList(booking?.payments || localPayments.map((p) => (p.id === editingId ? data : p)));
      }

      if (booking) onBookingUpdated?.(booking);
      cancelEdit();
      toast.success(adding ? 'Payment added' : 'Payment updated');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this payment from the series?')) return;
    setLoading(true);
    try {
      const { data } = await api.delete(`/booking-payments/${id}`);
      syncList(data.booking?.payments || localPayments.filter((p) => p.id !== id));
      if (data.booking) onBookingUpdated?.(data.booking);
      if (editingId === id) cancelEdit();
      toast.success('Payment removed');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-aegean-800">Payment series</p>
          <p className="text-xs text-aegean-500 mt-0.5">
            Record each down payment, partial, and full payment separately so the SOA keeps the
            full history.
          </p>
        </div>
        {!adding && editingId == null && (
          <button
            type="button"
            onClick={startAdd}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-aegean-200 text-aegean-700 hover:bg-aegean-50 disabled:opacity-60"
          >
            <Plus size={14} /> Add payment
          </button>
        )}
      </div>

      {localPayments.length === 0 && !adding ? (
        <p className="text-sm text-aegean-500">No payments recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {localPayments.map((row) =>
            editingId === row.id ? (
              <li
                key={row.id}
                className="rounded-lg border border-aegean-200 bg-white p-3 space-y-3"
              >
                <PaymentFormFields editForm={editForm} setEditForm={setEditForm} />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSave}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={cancelEdit}
                    className="btn-outline text-xs px-3 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-aegean-100 bg-aegean-50/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-aegean-800">
                    {paymentTypeLabel(row.payment_type)}
                  </p>
                  <p className="text-xs text-aegean-500 mt-0.5">
                    {toDateInputValue(row.paid_at)}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-medium text-aegean-900 mr-1">
                    ₱{formatMoney(row.amount)}
                  </span>
                  <IconActionButton
                    icon={Pencil}
                    label="Edit payment"
                    onClick={() => startEdit(row)}
                    disabled={loading || adding}
                  />
                  <IconActionButton
                    icon={Trash2}
                    label="Delete payment"
                    onClick={() => handleDelete(row.id)}
                    disabled={loading || adding}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                  />
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {adding && (
        <div className="rounded-lg border border-aegean-200 bg-white p-3 space-y-3">
          <PaymentFormFields editForm={editForm} setEditForm={setEditForm} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleSave}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60"
            >
              Add payment
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={cancelEdit}
              className="btn-outline text-xs px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between border-t border-aegean-100 pt-2 text-sm text-aegean-800">
        <span>Recorded total</span>
        <span className="font-semibold">₱{formatMoney(paidTotal)}</span>
      </div>
      <div className="flex justify-between text-sm text-aegean-800">
        <span>Balance due</span>
        <span className="font-semibold">₱{formatMoney(balanceDue)}</span>
      </div>
    </div>
  );
}
