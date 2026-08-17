import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import AdminModal, { AdminModalCancel } from '../components/admin/AdminModal';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { groupMenuByCategory } from '../utils/menuGrouping';
import { useDirtySnapshot } from '../hooks/useConfirmLeave';

const DEFAULT_CATEGORIES = ['All Day Breakfast', 'Rice Meals', 'Snacks & Extras', 'Drinks'];

const emptyForm = () => ({
  name: '',
  category: DEFAULT_CATEGORIES[0],
  price: '',
  sort_order: 0,
});

const NEW_CATEGORY = '__new__';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

function CategoryField({ id, value, onChange, options }) {
  const known = options.includes(value);
  const [customMode, setCustomMode] = useState(() => Boolean(value) && !known);

  useEffect(() => {
    if (value && !options.includes(value)) {
      setCustomMode(true);
    }
  }, [value, options]);

  return (
    <div className="space-y-2">
      <select
        id={id}
        value={customMode ? NEW_CATEGORY : value}
        onChange={(e) => {
          if (e.target.value === NEW_CATEGORY) {
            setCustomMode(true);
            onChange('');
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
        className={inputClass}
      >
        {options.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
        <option value={NEW_CATEGORY}>+ Add new category…</option>
      </select>
      {customMode && (
        <input
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="New category name"
          className={inputClass}
          aria-label="New category name"
        />
      )}
    </div>
  );
}

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

function MenuItemForm({ form, setForm, categoryOptions, idPrefix }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <label>
        <FieldLabel required>Name</FieldLabel>
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={inputClass}
        />
      </label>
      <label>
        <FieldLabel required>Category</FieldLabel>
        <CategoryField
          id={`${idPrefix}-category`}
          value={form.category}
          onChange={(category) => setForm((f) => ({ ...f, category }))}
          options={categoryOptions}
        />
      </label>
      <label>
        <FieldLabel required>Price (₱)</FieldLabel>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={form.price}
          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          className={inputClass}
        />
      </label>
      <label>
        <FieldLabel>Sort order</FieldLabel>
        <input
          type="number"
          min={0}
          value={form.sort_order}
          onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
          className={inputClass}
        />
        <p className="text-xs text-aegean-500 mt-1">
          Lower = first in category. Also sets category order (lowest item in the group wins).
        </p>
      </label>
    </div>
  );
}

export default function AdminMenu() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const isDirty = useDirtySnapshot(form, modalOpen);

  const categoryOptions = useMemo(() => {
    const fromItems = items.map((i) => i.category?.trim()).filter(Boolean);
    return [...new Set([...DEFAULT_CATEGORIES, ...fromItems])].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [items]);

  const grouped = useMemo(() => groupMenuByCategory(items), [items]);

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

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      category: item.category || DEFAULT_CATEGORIES[0],
      price: item.price ?? '',
      sort_order: item.sort_order ?? 0,
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isEdit = Boolean(editingId);
    const ok = await confirm({
      title: isEdit ? 'Save changes?' : 'Add menu item?',
      message: isEdit
        ? `Update "${form.name.trim()}" on the menu?`
        : `Add "${form.name.trim()}" to the menu?`,
      confirmLabel: isEdit ? 'Yes, save' : 'Yes, add item',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        const { data } = await api.put(`/menu/admin/${editingId}`, {
          name: form.name.trim(),
          category: form.category.trim(),
          price: form.price,
          sort_order: Number(form.sort_order) || 0,
          is_active: 1,
        });
        setItems((prev) => prev.map((row) => (row.id === data.id ? data : row)));
        toast.success(`${data.name} saved.`);
      } else {
        const { data } = await api.post('/menu/admin', {
          name: form.name.trim(),
          category: form.category.trim(),
          price: Number(form.price),
          sort_order: Number(form.sort_order) || 0,
          is_active: 1,
        });
        setItems((prev) =>
          [...prev, data].sort(
            (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
          )
        );
        toast.success('Menu item added.');
      }
      closeModal();
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
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
      if (editingId === item.id) closeModal();
      toast.success('Menu item removed.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-aegean-800 mb-2">Meals & Menu</h1>
          <p className="text-aegean-600 text-sm max-w-3xl">
            Manage café items on the public Meals page.{' '}
            <strong className="font-medium text-aegean-700">Sort:</strong> lower numbers appear
            first inside each category. Category sections are ordered by their lowest sort
            number.
          </p>
        </div>
        <button type="button" onClick={openAdd} className="btn-primary text-sm flex items-center gap-2 shrink-0">
          <Plus size={18} /> Add menu item
        </button>
      </div>

      {error && !modalOpen && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {items.length === 0 ? (
        <p className="text-aegean-600 text-sm bg-white rounded-xl border border-aegean-100 p-6">
          No menu items yet. Click Add menu item to create one.
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
                      <th className="px-4 py-3 font-medium w-16">Sort</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium w-28">Price</th>
                      <th className="px-4 py-3 font-medium w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.map((item) => (
                      <tr key={item.id} className="border-t border-aegean-100">
                        <td className="px-4 py-3 text-aegean-500 tabular-nums">
                          {item.sort_order ?? 0}
                        </td>
                        <td className="px-4 py-3 font-medium text-aegean-900">{item.name}</td>
                        <td className="px-4 py-3 text-aegean-600 tabular-nums">
                          {formatPrice(item.price)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <IconActionGroup className="justify-end">
                            <IconActionButton
                              icon={Pencil}
                              label="Edit item"
                              onClick={() => openEdit(item)}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <AdminModal
        open={modalOpen}
        onClose={closeModal}
        isDirty={isDirty}
        title={editingId ? 'Edit menu item' : 'Add menu item'}
        description={
          editingId
            ? 'Update this item on the public Meals page.'
            : 'Create a new item for the public Meals page.'
        }
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <MenuItemForm
            form={form}
            setForm={setForm}
            categoryOptions={categoryOptions}
            idPrefix={editingId ? 'menu-edit' : 'menu-add'}
          />
          <div className="flex flex-wrap gap-3 pt-2">
            <SubmitButton loading={saving} loadingLabel="Saving..." className="text-sm">
              {editingId ? 'Save changes' : 'Add item'}
            </SubmitButton>
            <AdminModalCancel />
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
