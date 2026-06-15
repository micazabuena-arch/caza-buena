import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import api, { getApiError } from '../api/client';
import { getAssetUrl } from '../utils/assetUrl';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import AdminModal from '../components/admin/AdminModal';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';

const PAYMENT_TYPES = [
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
  { value: 'bdo', label: 'BDO Bank' },
  { value: 'bpi', label: 'BPI Bank' },
  { value: 'other', label: 'Other' },
];

const typeLabel = (type) => PAYMENT_TYPES.find((t) => t.value === type)?.label || type;

const emptyForm = () => ({
  name: '',
  type: 'gcash',
  account_name: '',
  account_number: '',
  instructions: '',
  is_active: true,
  sort_order: 0,
  qrFile: null,
});

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

function FieldLabel({ children, required }) {
  return (
    <span className="block text-sm font-medium text-aegean-700 mb-1.5">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
}

export default function AdminPaymentMethods() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const { page, setPage, pageItems, totalPages, totalItems, from, to } = usePagination(methods);

  const editingMethod = editingId ? methods.find((m) => m.id === editingId) : null;

  const load = () => {
    setLoading(true);
    api
      .get('/payment-methods/admin/all')
      .then((r) => setMethods(r.data))
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

  const openEdit = (method) => {
    setEditingId(method.id);
    setForm({
      name: method.name || '',
      type: method.type || 'other',
      account_name: method.account_name || '',
      account_number: method.account_number || '',
      instructions: method.instructions || '',
      is_active: method.is_active !== 0,
      sort_order: method.sort_order ?? 0,
      qrFile: null,
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

  const buildFormData = () => {
    const body = new FormData();
    body.append('name', form.name.trim());
    body.append('account_name', form.account_name.trim());
    body.append('account_number', form.account_number.trim());
    body.append('instructions', form.instructions.trim());
    body.append('is_active', form.is_active ? '1' : '0');
    if (form.qrFile) body.append('qr', form.qrFile);
    if (!editingId) {
      body.append('type', form.type);
      body.append('sort_order', String(form.sort_order || 0));
    }
    return body;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Payment name is required.');
      return;
    }

    const isEdit = Boolean(editingId);
    const ok = await confirm({
      title: isEdit ? 'Save payment method?' : 'Add payment method?',
      message: isEdit
        ? `Update ${form.name.trim()} on the website?`
        : `Add "${form.name.trim()}" as a payment option on the site?`,
      confirmLabel: isEdit ? 'Yes, save' : 'Yes, add',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const body = buildFormData();
      if (isEdit) {
        const { data } = await api.put(`/payment-methods/admin/${editingId}`, body);
        setMethods((prev) => prev.map((m) => (m.id === data.id ? data : m)));
        toast.success(`${data.name} saved.`);
      } else {
        const { data } = await api.post('/payment-methods/admin', body);
        setMethods((prev) =>
          [...prev, data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        );
        toast.success(`${data.name} added.`);
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

  const remove = async (method) => {
    const ok = await confirm({
      title: 'Delete payment method?',
      message: `Remove "${method.name}" from the website? This cannot be undone.`,
      confirmLabel: 'Yes, delete',
      variant: 'danger',
    });
    if (!ok) return;

    setDeleting(method.id);
    setError('');
    try {
      await api.delete(`/payment-methods/admin/${method.id}`);
      setMethods((prev) => prev.filter((m) => m.id !== method.id));
      if (editingId === method.id) closeModal();
      toast.success(`${method.name} removed.`);
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h1 className="text-3xl font-serif text-aegean-800">Payment Methods</h1>
        <button type="button" onClick={openAdd} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={18} /> Add payment method
        </button>
      </div>
      <p className="text-aegean-600 text-sm mb-8">
        Manage QR codes and instructions for GCash, Maya, bank transfers, and more.
      </p>
      {error && !modalOpen && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        {methods.length === 0 ? (
          <p className="text-aegean-600 text-sm bg-white rounded-xl border border-aegean-100 p-6">
            No payment methods yet. Click Add payment method to create one.
          </p>
        ) : (
          pageItems.map((m) => (
            <div
              key={m.id}
              className="bg-white p-4 rounded-xl border border-aegean-100 flex justify-between items-start gap-4"
            >
              <div className="flex gap-4 min-w-0 flex-1">
                {m.qr_image_url && (
                  <img
                    src={getAssetUrl(m.qr_image_url)}
                    alt={`${m.name} QR`}
                    className="w-16 h-16 object-contain border border-aegean-100 rounded-lg shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-aegean-900">{m.name}</p>
                  <p className="text-xs text-aegean-500 mt-0.5">{typeLabel(m.type)}</p>
                  {(m.account_name || m.account_number) && (
                    <p className="text-sm text-aegean-600 mt-1">
                      {[m.account_name, m.account_number].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {m.instructions && (
                    <p className="text-sm text-aegean-500 mt-1 line-clamp-2">{m.instructions}</p>
                  )}
                </div>
              </div>
              <IconActionGroup className="shrink-0">
                <IconActionButton icon={Pencil} label={`Edit ${m.name}`} onClick={() => openEdit(m)} />
                <IconActionButton
                  icon={Trash2}
                  label={`Delete ${m.name}`}
                  onClick={() => remove(m)}
                  loading={deleting === m.id}
                  disabled={Boolean(deleting)}
                  className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                />
              </IconActionGroup>
            </div>
          ))
        )}
        {methods.length > 0 && (
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

      <AdminModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit payment method' : 'Add payment method'}
        description={
          editingId
            ? 'Update QR code and payment instructions shown to guests.'
            : 'Add a new GCash, Maya, bank, or other payment option.'
        }
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <label className="block">
            <FieldLabel required>Name</FieldLabel>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder="e.g. GCash, BDO Savings"
            />
          </label>
          <label className="block">
            <FieldLabel>Type</FieldLabel>
            {editingId ? (
              <input
                readOnly
                value={typeLabel(form.type)}
                className={`${inputClass} bg-aegean-50`}
                title="Type is set when the method was created"
              />
            ) : (
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className={inputClass}
              >
                {PAYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <FieldLabel>Account name</FieldLabel>
              <input
                value={form.account_name}
                onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel>Account number</FieldLabel>
              <input
                value={form.account_number}
                onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
                className={inputClass}
              />
            </label>
          </div>
          <label className="block">
            <FieldLabel>Instructions</FieldLabel>
            <textarea
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              className={inputClass}
              placeholder="How guests should pay using this method"
            />
          </label>
          <div>
            <FieldLabel>QR image</FieldLabel>
            {editingMethod?.qr_image_url && !form.qrFile && (
              <img
                src={getAssetUrl(editingMethod.qr_image_url)}
                alt="Current QR"
                className="w-24 h-24 object-contain border border-aegean-100 rounded-lg mb-2"
              />
            )}
            <label className="btn-outline text-sm py-2 px-4 inline-block cursor-pointer">
              {form.qrFile ? 'Change file' : 'Upload QR image'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setForm((f) => ({ ...f, qrFile: e.target.files?.[0] || null }))}
              />
            </label>
            {form.qrFile && (
              <p className="text-xs text-aegean-500 mt-1">{form.qrFile.name}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <SubmitButton loading={saving} loadingLabel="Saving..." className="text-sm">
              {editingId ? 'Save changes' : 'Add payment method'}
            </SubmitButton>
            <button type="button" onClick={closeModal} className="btn-outline text-sm">
              Cancel
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
