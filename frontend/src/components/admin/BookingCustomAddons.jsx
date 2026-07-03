import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import IconActionButton from '../ui/IconActionButton';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

export default function BookingCustomAddons({ bookingId, addons = [], onChange }) {
  const [localAddons, setLocalAddons] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ label: '', description: '', amount: '', include_in_soa: true, include_in_confirmation: true });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (Array.isArray(addons)) {
      setLocalAddons(addons.map(a => ({ ...a, _editing: false })));
    }
  }, [addons]);

  const loadAddons = async () => {
    if (!bookingId) return;
    try {
      const { data } = await api.get(`/booking-addons/booking/${bookingId}`);
      setLocalAddons(data || []);
      onChange?.(data || []);
    } catch (err) {
      console.error('Failed to load add-ons:', err);
    }
  };

  useEffect(() => {
    loadAddons();
  }, [bookingId]);

  const startAdd = () => {
    setEditingId('new');
    setEditForm({ label: '', description: '', amount: '', include_in_soa: true, include_in_confirmation: true });
  };

  const startEdit = (addon) => {
    setEditingId(addon.id);
    setEditForm({
      label: addon.label || '',
      description: addon.description || '',
      amount: String(addon.amount || ''),
      include_in_soa: Boolean(addon.include_in_soa ?? addon.show_in_soa),
      include_in_confirmation: Boolean(addon.include_in_confirmation ?? addon.show_in_soa),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ label: '', description: '', amount: '', include_in_soa: true, include_in_confirmation: true });
  };

  const saveAddon = async () => {
    if (!editForm.label.trim()) {
      toast.error('Label is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        label: editForm.label.trim(),
        description: editForm.description?.trim() || '',
        amount: parseFloat(editForm.amount) || 0,
        include_in_soa: editForm.include_in_soa ? 1 : 0,
        include_in_confirmation: editForm.include_in_confirmation ? 1 : 0,
      };

      if (editingId === 'new') {
        const { data } = await api.post(`/booking-addons/booking/${bookingId}`, payload);
        setLocalAddons(prev => [...prev, { ...data, _editing: false }]);
        toast.success('Add-on created');
      } else {
        const { data } = await api.put(`/booking-addons/${editingId}`, payload);
        setLocalAddons(prev => prev.map(a => a.id === editingId ? { ...data, _editing: false } : a));
        toast.success('Add-on updated');
      }
      
      onChange?.(localAddons);
      cancelEdit();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save add-on');
    } finally {
      setLoading(false);
    }
  };

  const deleteAddon = async (id) => {
    if (!confirm('Delete this add-on?')) return;
    
    try {
      await api.delete(`/booking-addons/${id}`);
      setLocalAddons(prev => prev.filter(a => a.id !== id));
      toast.success('Add-on deleted');
      onChange?.(localAddons.filter(a => a.id !== id));
    } catch (err) {
      toast.error('Failed to delete add-on');
    }
  };

  const totalAmount = localAddons.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-aegean-800">Custom Add-ons</p>
          <p className="text-xs text-aegean-500">Room extensions, ordered food, and other charges</p>
        </div>
        {editingId !== 'new' && (
          <button type="button" onClick={startAdd} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={16} />
            Add Add-on
          </button>
        )}
      </div>

      {editingId === 'new' && (
        <div className="bg-aegean-50 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-aegean-700">New Add-on</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-aegean-600 mb-1">Label *</span>
              <input
                type="text"
                value={editForm.label}
                onChange={(e) => setEditForm(f => ({ ...f, label: e.target.value }))}
                className={inputClass}
                placeholder="e.g., Room Extension"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-aegean-600 mb-1">Amount (₱)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.amount}
                onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))}
                className={inputClass}
                placeholder="0.00"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-aegean-600 mb-1">Description</span>
            <input
              type="text"
              value={editForm.description}
              onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
              className={inputClass}
              placeholder="Optional details"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editForm.include_in_soa}
                onChange={(e) => setEditForm(f => ({ ...f, include_in_soa: e.target.checked }))}
                className="rounded border-aegean-300 text-aegean-600 focus:ring-aegean-400"
              />
              <span className="text-sm text-aegean-700">Include in SOA</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editForm.include_in_confirmation}
                onChange={(e) => setEditForm(f => ({ ...f, include_in_confirmation: e.target.checked }))}
                className="rounded border-aegean-300 text-aegean-600 focus:ring-aegean-400"
              />
              <span className="text-sm text-aegean-700">Include in Confirmation</span>
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={saveAddon} disabled={loading} className="btn-primary text-sm">
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={cancelEdit} className="btn-outline text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {localAddons.length === 0 && editingId !== 'new' && (
        <p className="text-sm text-aegean-500 text-center py-4">No custom add-ons yet.</p>
      )}

      {localAddons.length > 0 && editingId !== 'new' && (
        <div className="space-y-2">
          {localAddons.map((addon) => (
            <div
              key={addon.id}
              className={`border border-aegean-100 rounded-lg p-3 ${editingId === addon.id ? 'bg-aegean-50' : 'bg-white'}`}
            >
              {editingId === addon.id ? (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-xs font-medium text-aegean-600 mb-1">Label *</span>
                      <input
                        type="text"
                        value={editForm.label}
                        onChange={(e) => setEditForm(f => ({ ...f, label: e.target.value }))}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-medium text-aegean-600 mb-1">Amount (₱)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.amount}
                        onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="block text-xs font-medium text-aegean-600 mb-1">Description</span>
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.include_in_soa}
                        onChange={(e) => setEditForm(f => ({ ...f, include_in_soa: e.target.checked }))}
                        className="rounded border-aegean-300 text-aegean-600 focus:ring-aegean-400"
                      />
                      <span className="text-sm text-aegean-700">Include in SOA</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.include_in_confirmation}
                        onChange={(e) => setEditForm(f => ({ ...f, include_in_confirmation: e.target.checked }))}
                        className="rounded border-aegean-300 text-aegean-600 focus:ring-aegean-400"
                      />
                      <span className="text-sm text-aegean-700">Include in Confirmation</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveAddon} disabled={loading} className="btn-primary text-sm">
                      {loading ? 'Updating...' : 'Update'}
                    </button>
                    <button type="button" onClick={cancelEdit} className="btn-outline text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-aegean-800">{addon.label}</p>
                      {!addon.include_in_soa && !(addon.show_in_soa ?? true) && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Not in SOA</span>
                      )}
                      {!addon.include_in_confirmation && !(addon.show_in_soa ?? true) && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Not in Confirmation</span>
                      )}
                    </div>
                    {addon.description && (
                      <p className="text-xs text-aegean-500 mt-0.5">{addon.description}</p>
                    )}
                    <p className="text-sm font-medium text-aegean-700 mt-1">₱{Number(addon.amount).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1">
                    <IconActionButton icon={Pencil} label="Edit" onClick={() => startEdit(addon)} />
                    <IconActionButton icon={Trash2} label="Delete" onClick={() => deleteAddon(addon.id)} variant="danger" />
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {totalAmount > 0 && (
            <div className="border-t border-aegean-100 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-aegean-700">Total Add-ons:</span>
                <span className="text-lg font-bold text-aegean-800">₱{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
