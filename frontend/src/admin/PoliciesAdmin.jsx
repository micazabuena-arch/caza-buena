import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import AdminModal, { AdminModalCancel } from '../components/admin/AdminModal';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useDirtySnapshot } from '../hooks/useConfirmLeave';

const emptyForm = () => ({
  title: '',
  content: '',
});

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

export default function AdminPolicies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const { page, setPage, pageItems, totalPages, totalItems, from, to } = usePagination(policies);
  const isDirty = useDirtySnapshot(form, modalOpen);

  const load = () =>
    api
      .get('/policies')
      .then((r) => setPolicies(r.data))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setModalOpen(true);
  };

  const openEdit = (policy) => {
    setEditingId(policy.id);
    setForm({
      title: policy.title || '',
      content: policy.content || '',
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
      title: isEdit ? 'Save policy changes?' : 'Add policy?',
      message: isEdit
        ? `Update "${form.title.trim()}" on the website?`
        : 'This policy will appear on the public Policies page.',
      confirmLabel: isEdit ? 'Yes, save' : 'Yes, add policy',
    });
    if (!ok) return;

    setError('');
    setSubmitting(true);
    try {
      if (isEdit) {
        const policy = policies.find((p) => p.id === editingId);
        await api.put(`/policies/admin/${editingId}`, {
          title: form.title.trim(),
          content: form.content.trim(),
          is_active: policy?.is_active ?? 1,
          sort_order: policy?.sort_order ?? 0,
        });
        toast.success('Policy updated.');
      } else {
        await api.post('/policies/admin', {
          title: form.title.trim(),
          content: form.content.trim(),
        });
        toast.success('Policy added.');
      }
      closeModal();
      load();
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const removePolicy = async (policy) => {
    const ok = await confirm({
      title: 'Remove policy?',
      message: `"${policy.title}" will be hidden from the website.`,
      confirmLabel: 'Yes, remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.put(`/policies/admin/${policy.id}`, {
        ...policy,
        is_active: 0,
      });
      setPolicies((prev) => prev.filter((p) => p.id !== policy.id));
      toast.success('Policy removed.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-serif text-aegean-800">Policies</h1>
        <button type="button" onClick={openAdd} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={18} /> Add policy
        </button>
      </div>

      <div className="space-y-3">
        {policies.length === 0 ? (
          <p className="text-aegean-600 text-sm bg-white rounded-xl border border-aegean-100 p-6">
            No policies yet. Click Add policy to create one.
          </p>
        ) : (
          pageItems.map((policy) => (
            <div
              key={policy.id}
              className="bg-white p-4 rounded-xl border border-aegean-100 flex justify-between items-start gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-aegean-900">{policy.title}</p>
                <p className="text-sm text-aegean-600 mt-1 line-clamp-3 whitespace-pre-line">
                  {policy.content}
                </p>
              </div>
              <IconActionGroup className="shrink-0">
                <IconActionButton icon={Pencil} label="Edit policy" onClick={() => openEdit(policy)} />
                <IconActionButton
                  icon={Trash2}
                  label="Remove policy"
                  className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                  onClick={() => removePolicy(policy)}
                />
              </IconActionGroup>
            </div>
          ))
        )}
        {policies.length > 0 && (
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
        isDirty={isDirty}
        title={editingId ? 'Edit policy' : 'Add policy'}
        description={
          editingId
            ? 'Update the title or content shown on the public Policies page.'
            : 'Create a new policy for the public Policies page.'
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
            <span className="block text-sm font-medium text-aegean-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClass}
              placeholder="e.g. Cancellation Policy"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-aegean-700 mb-1.5">
              Content <span className="text-red-500">*</span>
            </span>
            <textarea
              required
              rows={6}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className={inputClass}
              placeholder="Policy text for guests"
            />
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <SubmitButton loading={submitting} loadingLabel="Saving..." className="text-sm">
              {editingId ? 'Save changes' : 'Add policy'}
            </SubmitButton>
            <AdminModalCancel />
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
