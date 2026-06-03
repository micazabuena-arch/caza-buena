import { Fragment, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const CATEGORIES = ['All Day Breakfast', 'Rice Meals', 'Snacks & Extras', 'Drinks'];

const emptyForm = {
  name: '',
  category: CATEGORIES[0],
  price: '',
  sort_order: 0,
};

function FieldLabel({ children, required }) {
  return (
    <span className="block text-sm font-medium text-aegean-700 mb-1.5">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
}

function formatPrice(price) {
  const n = Number(price);
  return Number.isNaN(n) ? '—' : `₱${n.toLocaleString()}`;
}

export default function AdminMenu() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const cat = item.category || 'Menu';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(item);
    }
    return [...map.entries()];
  }, [items]);

  const load = () => {
    setLoading(true);
    setError('');
    api
      .get('/menu/admin/all')
      .then((r) => setItems(Array.isArray(r.data) ? r.data : []))
      .catch((e) => setError(getApiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (id, field, value) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const saveItem = async (item) => {
    const ok = await confirm({
      title: 'Save changes?',
      message: `Update "${item.name}" on the menu?`,
      confirmLabel: 'Yes, save',
    });
    if (!ok) return;
    setSaving(item.id);
    setError('');
    try {
      const { data } = await api.put(`/menu/admin/${item.id}`, {
        name: item.name,
        category: item.category,
        price: item.price,
        sort_order: item.sort_order ?? 0,
        is_active: item.is_active ? 1 : 0,
      });
      setItems((prev) => prev.map((row) => (row.id === data.id ? data : row)));
      setEditingId(null);
      toast.success(`${data.name} saved.`);
    } catch (e) {
      const msg = getApiError(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(null);
    }
  };

  const removeItem = async (item) => {
    const ok = await confirm({
      title: 'Remove menu item?',
      message: `"${item.name}" will be hidden from the public Meals page.`,
      confirmLabel: 'Yes, remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/menu/admin/${item.id}`);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (editingId === item.id) setEditingId(null);
      toast.success('Menu item removed.');
    } catch (e) {
      toast.error(getApiError(e));
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Add menu item?',
      message: `Add "${form.name.trim()}" to the menu?`,
      confirmLabel: 'Yes, add item',
    });
    if (!ok) return;
    setAdding(true);
    setError('');
    try {
      const { data } = await api.post('/menu/admin', {
        name: form.name.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        sort_order: Number(form.sort_order) || 0,
        is_active: 1,
      });
      setItems((prev) => [...prev, data].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
      setForm(emptyForm);
      toast.success('Menu item added.');
    } catch (e) {
      const msg = getApiError(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-serif text-aegean-800 mb-2">Meals & Menu</h1>
      <p className="text-aegean-600 text-sm mb-8">
        Manage café items on the public Meals page — name and price only.
      </p>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-aegean-100 shadow-sm p-6 mb-10 space-y-4">
        <h2 className="font-medium text-aegean-800">Add menu item</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>
            <FieldLabel required>Name</FieldLabel>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </label>
          <label>
            <FieldLabel required>Category</FieldLabel>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm bg-white"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label>
            <FieldLabel required>Price (₱)</FieldLabel>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </label>
          <label>
            <FieldLabel>Sort order</FieldLabel>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </label>
        </div>
        <SubmitButton loading={adding} loadingLabel="Adding..." className="text-sm">
          Add item
        </SubmitButton>
      </form>

      {items.length === 0 ? (
        <p className="text-aegean-600 text-sm bg-white rounded-xl border border-aegean-100 p-6">
          No menu items yet. Add your first item above.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([category, categoryItems]) => (
            <section key={category}>
              <h2 className="text-lg font-serif text-aegean-800 mb-3">{category}</h2>
              <div className="bg-white rounded-2xl border border-aegean-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-aegean-50 text-aegean-600 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium w-28">Price</th>
                      <th className="px-4 py-3 font-medium w-24">Active</th>
                      <th className="px-4 py-3 font-medium w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.map((item) => (
                      <Fragment key={item.id}>
                        <tr className="border-t border-aegean-100">
                          <td className="px-4 py-3 font-medium text-aegean-900">{item.name}</td>
                          <td className="px-4 py-3 text-aegean-600 tabular-nums">{formatPrice(item.price)}</td>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={!!item.is_active}
                              onChange={(e) => updateField(item.id, 'is_active', e.target.checked ? 1 : 0)}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <IconActionGroup className="justify-end">
                              <IconActionButton
                                icon={editingId === item.id ? X : Pencil}
                                label={editingId === item.id ? 'Close edit' : 'Edit item'}
                                onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                              />
                              <IconActionButton
                                icon={Trash2}
                                label="Remove item"
                                className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                onClick={() => removeItem(item)}
                              />
                            </IconActionGroup>
                          </td>
                        </tr>
                        {editingId === item.id && (
                          <tr className="border-t border-aegean-100 bg-aegean-50/50">
                            <td colSpan={4} className="px-4 py-4">
                              <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
                                <label>
                                  <FieldLabel required>Name</FieldLabel>
                                  <input
                                    value={item.name || ''}
                                    onChange={(e) => updateField(item.id, 'name', e.target.value)}
                                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  />
                                </label>
                                <label>
                                  <FieldLabel required>Category</FieldLabel>
                                  <select
                                    value={item.category || CATEGORIES[0]}
                                    onChange={(e) => updateField(item.id, 'category', e.target.value)}
                                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  >
                                    {CATEGORIES.map((cat) => (
                                      <option key={cat} value={cat}>
                                        {cat}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  <FieldLabel required>Price (₱)</FieldLabel>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.price ?? ''}
                                    onChange={(e) => updateField(item.id, 'price', e.target.value)}
                                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  />
                                </label>
                                <label>
                                  <FieldLabel>Sort order</FieldLabel>
                                  <input
                                    type="number"
                                    value={item.sort_order ?? 0}
                                    onChange={(e) => updateField(item.id, 'sort_order', e.target.value)}
                                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
                                  />
                                </label>
                                <div className="sm:col-span-2">
                                  <SubmitButton
                                    type="button"
                                    onClick={() => saveItem(item)}
                                    loading={saving === item.id}
                                    loadingLabel="Saving..."
                                    className="text-sm"
                                  >
                                    Save changes
                                  </SubmitButton>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
