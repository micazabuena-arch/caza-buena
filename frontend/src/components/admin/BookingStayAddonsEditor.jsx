import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api, { getApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { parseStayAddons, STAY_ADDON_PRESETS } from '../../utils/stayAddons';

export default function BookingStayAddonsEditor({ booking, onUpdated }) {
  const toast = useToast();
  const [addons, setAddons] = useState(() => parseStayAddons(booking?.stay_addons));
  const [description, setDescription] = useState(STAY_ADDON_PRESETS[0].description);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    const parsedAmount = Math.round((Number(amount) || 0) * 100) / 100;
    const trimmed = description.trim();
    if (!trimmed) {
      toast.error('Enter a description for the add-on.');
      return;
    }
    if (!(parsedAmount > 0)) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    setAddons((prev) => [
      ...prev,
      { id: `addon-${Date.now()}`, description: trimmed, amount: parsedAmount },
    ]);
    setAmount('');
  };

  const handleRemove = (id) => {
    setAddons((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/bookings/admin/${booking.id}/stay-addons`, {
        stay_addons: addons,
      });
      setAddons(parseStayAddons(data.booking?.stay_addons));
      onUpdated?.(data.booking);
      toast.success('During-stay add-ons saved.');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const addonsTotal = addons.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="border-t border-aegean-100 pt-4 mt-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-aegean-800">During-stay add-ons</h3>
        <p className="text-xs text-aegean-500 mt-1">
          Room extensions, food orders, and other charges added while the guest is checked in. These
          appear on the SOA.
        </p>
      </div>

      {addons.length > 0 ? (
        <ul className="space-y-2">
          {addons.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-aegean-100 bg-aegean-50/40 px-3 py-2 text-sm"
            >
              <span className="text-aegean-800">{item.description}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-medium text-aegean-900">
                  ₱{item.amount.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                  aria-label={`Remove ${item.description}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
          <li className="text-sm text-aegean-700 pt-1">
            <strong>Subtotal:</strong> ₱{addonsTotal.toLocaleString()}
          </li>
        </ul>
      ) : (
        <p className="text-sm text-aegean-500">No during-stay add-ons yet.</p>
      )}

      <div className="rounded-lg border border-aegean-100 p-3 space-y-3 bg-white">
        <p className="text-xs font-medium text-aegean-600 uppercase tracking-wide">Add charge</p>
        <div className="flex flex-wrap gap-2">
          {STAY_ADDON_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDescription(preset.description)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                description === preset.description
                  ? 'border-aegean-600 bg-aegean-50 text-aegean-800'
                  : 'border-aegean-200 text-aegean-600 hover:border-aegean-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-[1fr_140px_auto] gap-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. Room extension — 1 night)"
            className="input text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="input text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="btn-outline text-sm inline-flex items-center justify-center gap-1"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-primary text-sm disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save add-ons'}
      </button>
    </div>
  );
}
