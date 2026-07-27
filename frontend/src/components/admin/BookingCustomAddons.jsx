import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api, { getApiError } from '../../api/client';
import { formatMoney } from '../../utils/money';
import { useToast } from '../../context/ToastContext';
import IconActionButton from '../ui/IconActionButton';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

const EMPTY_FORM = {
  label: '',
  description: '',
  amount: '',
  include_in_soa: true,
  include_in_confirmation: true,
};

function AddonFormFields({ editForm, setEditForm }) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-aegean-600 mb-1">Label *</span>
          <input
            type="text"
            value={editForm.label}
            onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
            className={inputClass}
            placeholder="e.g. Room extension, Ordered food"
          />
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
      <label className="block">
        <span className="block text-xs font-medium text-aegean-600 mb-1">Description (optional)</span>
        <input
          type="text"
          value={editForm.description}
          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
          className={inputClass}
          placeholder="Optional details"
        />
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={editForm.include_in_soa}
            onChange={(e) => setEditForm((f) => ({ ...f, include_in_soa: e.target.checked }))}
            className="rounded border-aegean-300 text-aegean-600 focus:ring-aegean-400"
          />
          <span className="text-sm text-aegean-700">Show on SOA</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={editForm.include_in_confirmation}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, include_in_confirmation: e.target.checked }))
            }
            className="rounded border-aegean-300 text-aegean-600 focus:ring-aegean-400"
          />
          <span className="text-sm text-aegean-700">Show on confirmation</span>
        </label>
      </div>
    </div>
  );
}

/**
 * Admin-only during-stay charges (room extension, food, etc.).
 * Saves immediately via API — independent of the Edit stay form submit.
 */
export default function BookingCustomAddons({ bookingId, addons = [], onChange, onBookingUpdated }) {
  const [localAddons, setLocalAddons] = useState(() => (Array.isArray(addons) ? addons : []));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const syncList = useCallback(
    (next) => {
      setLocalAddons(next);
      onChange?.(next);
    },
    [onChange]
  );

  // Load from API when booking changes (don't reset from unstable [] prop references)
  useEffect(() => {
    if (!bookingId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(`/booking-addons/booking/${bookingId}`);
        if (!cancelled) syncList(data || []);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load add-ons:', err);
          // Fall back to whatever the parent already has
          if (Array.isArray(addons) && addons.length > 0) {
            setLocalAddons(addons);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when booking changes
  }, [bookingId]);

  const startAdd = () => {
    setEditingId('new');
    setEditForm(EMPTY_FORM);
  };

  const startEdit = (addon) => {
    setEditingId(addon.id);
    setEditForm({
      label: addon.label || '',
      description: addon.description || '',
      amount: String(addon.amount ?? ''),
      include_in_soa: Boolean(Number(addon.include_in_soa ?? 1)),
      include_in_confirmation: Boolean(Number(addon.include_in_confirmation ?? 1)),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const saveAddon = async () => {
    if (!editForm.label.trim()) {
      toast.error('Label is required');
      return;
    }
    const amount = parseFloat(editForm.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        label: editForm.label.trim(),
        description: editForm.description?.trim() || '',
        amount,
        include_in_soa: editForm.include_in_soa ? 1 : 0,
        include_in_confirmation: editForm.include_in_confirmation ? 1 : 0,
      };

      let next;
      let updatedBooking = null;
      if (editingId === 'new') {
        const { data } = await api.post(`/booking-addons/booking/${bookingId}`, payload);
        const { booking, ...addon } = data;
        updatedBooking = booking;
        next = [...localAddons, addon];
        toast.success('Add-on saved');
      } else {
        const { data } = await api.put(`/booking-addons/${editingId}`, payload);
        const { booking, ...addon } = data;
        updatedBooking = booking;
        next = localAddons.map((a) => (a.id === editingId ? addon : a));
        toast.success('Add-on updated');
      }

      syncList(next);
      cancelEdit();
      try {
        const { data: refreshed } = await api.get(`/bookings/admin/${bookingId}`);
        onBookingUpdated?.(refreshed);
      } catch {
        if (updatedBooking) onBookingUpdated?.(updatedBooking);
      }
    } catch (err) {
      toast.error(getApiError(err) || 'Failed to save add-on');
    } finally {
      setLoading(false);
    }
  };

  const deleteAddon = async (id) => {
    if (!window.confirm('Delete this add-on?')) return;

    try {
      const { data } = await api.delete(`/booking-addons/${id}`);
      const next = localAddons.filter((a) => a.id !== id);
      syncList(next);
      toast.success('Add-on deleted');
      try {
        const { data: refreshed } = await api.get(`/bookings/admin/${bookingId}`);
        onBookingUpdated?.(refreshed);
      } catch {
        if (data?.booking) onBookingUpdated?.(data.booking);
      }
    } catch (err) {
      toast.error(getApiError(err) || 'Failed to delete add-on');
    }
  };

  const totalAmount = localAddons.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-aegean-500">
          Saves right away — you don’t need “Save all changes” for these.
        </p>
        {editingId == null && (
          <button
            type="button"
            onClick={startAdd}
            className="btn-primary text-sm inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus size={16} />
            Add charge
          </button>
        )}
      </div>

      {editingId === 'new' && (
        <div className="rounded-lg border border-aegean-200 bg-aegean-50/60 p-4 space-y-3">
          <p className="text-sm font-medium text-aegean-800">New charge</p>
          <AddonFormFields editForm={editForm} setEditForm={setEditForm} />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={saveAddon} disabled={loading} className="btn-primary text-sm">
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={cancelEdit} className="btn-outline text-sm" disabled={loading}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {localAddons.length === 0 && editingId == null && (
        <p className="text-sm text-aegean-500 text-center py-6 border border-dashed border-aegean-200 rounded-lg">
          No extra charges yet. Add room extension, food orders, etc.
        </p>
      )}

      {localAddons.length > 0 && (
        <ul className="space-y-2">
          {localAddons.map((addon) => (
            <li
              key={addon.id}
              className={`border border-aegean-100 rounded-lg p-3 ${
                editingId === addon.id ? 'bg-aegean-50' : 'bg-white'
              }`}
            >
              {editingId === addon.id ? (
                <div className="space-y-3">
                  <AddonFormFields editForm={editForm} setEditForm={setEditForm} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveAddon}
                      disabled={loading}
                      className="btn-primary text-sm"
                    >
                      {loading ? 'Updating…' : 'Update'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="btn-outline text-sm"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-aegean-800">{addon.label}</p>
                      {!Number(addon.include_in_soa) && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Hidden from SOA
                        </span>
                      )}
                      {!Number(addon.include_in_confirmation) && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Hidden from confirmation
                        </span>
                      )}
                    </div>
                    {addon.description && (
                      <p className="text-xs text-aegean-500 mt-0.5">{addon.description}</p>
                    )}
                    <p className="text-sm font-medium text-aegean-700 mt-1">
                      ₱{formatMoney(addon.amount)}
                    </p>
                  </div>
                  {editingId == null && (
                    <div className="flex gap-1 shrink-0">
                      <IconActionButton icon={Pencil} label="Edit" onClick={() => startEdit(addon)} />
                      <IconActionButton
                        icon={Trash2}
                        label="Delete"
                        onClick={() => deleteAddon(addon.id)}
                        variant="danger"
                      />
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {totalAmount > 0 && editingId == null && (
        <div className="flex justify-between items-center border-t border-aegean-100 pt-3">
          <span className="text-sm font-medium text-aegean-700">Extra charges total</span>
          <span className="text-base font-semibold text-aegean-800">
            ₱{formatMoney(totalAmount)}
          </span>
        </div>
      )}
    </div>
  );
}
