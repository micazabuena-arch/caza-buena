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
  question: '',
  answer: '',
  category: 'general',
});

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

export default function AdminFAQ() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const { page, setPage, pageItems, totalPages, totalItems, from, to } = usePagination(faqs);
  const isDirty = useDirtySnapshot(form, modalOpen);

  const load = () => api.get('/faqs').then((r) => setFaqs(r.data)).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setModalOpen(true);
  };

  const openEdit = (faq) => {
    setEditingId(faq.id);
    setForm({
      question: faq.question || '',
      answer: faq.answer || '',
      category: faq.category || 'general',
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
      title: isEdit ? 'Save FAQ changes?' : 'Add FAQ?',
      message: isEdit
        ? 'Update this question on the public FAQ page?'
        : 'This question will appear on the public FAQ page.',
      confirmLabel: isEdit ? 'Yes, save' : 'Yes, add FAQ',
    });
    if (!ok) return;

    setError('');
    setSubmitting(true);
    try {
      if (isEdit) {
        const faq = faqs.find((f) => f.id === editingId);
        await api.put(`/faqs/admin/${editingId}`, {
          ...form,
          is_active: faq?.is_active ?? 1,
          sort_order: faq?.sort_order ?? 0,
        });
        toast.success('FAQ updated.');
      } else {
        await api.post('/faqs/admin', form);
        toast.success('FAQ added.');
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

  const removeFaq = async (faq) => {
    const ok = await confirm({
      title: 'Remove FAQ?',
      message: `"${faq.question}" will be hidden from the website.`,
      confirmLabel: 'Yes, remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.put(`/faqs/admin/${faq.id}`, { ...faq, is_active: 0 });
      load();
      toast.success('FAQ removed.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-serif text-aegean-800">FAQ Management</h1>
        <button type="button" onClick={openAdd} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={18} /> Add FAQ
        </button>
      </div>

      <div className="space-y-3">
        {faqs.length === 0 ? (
          <p className="text-aegean-600 text-sm bg-white rounded-xl border border-aegean-100 p-6">
            No FAQs yet. Click Add FAQ to create one.
          </p>
        ) : (
          pageItems.map((faq) => (
            <div
              key={faq.id}
              className="bg-white p-4 rounded-xl border border-aegean-100 flex justify-between items-start gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-aegean-900">{faq.question}</p>
                <p className="text-sm text-aegean-600 mt-1 line-clamp-3">{faq.answer}</p>
              </div>
              <IconActionGroup className="shrink-0">
                <IconActionButton icon={Pencil} label="Edit FAQ" onClick={() => openEdit(faq)} />
                <IconActionButton
                  icon={Trash2}
                  label="Remove FAQ"
                  className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                  onClick={() => removeFaq(faq)}
                />
              </IconActionGroup>
            </div>
          ))
        )}
        {faqs.length > 0 && (
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
        title={editingId ? 'Edit FAQ' : 'Add FAQ'}
        description={
          editingId
            ? 'Update the question or answer shown on the public FAQ page.'
            : 'Create a new question for the public FAQ page.'
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
              Question <span className="text-red-500">*</span>
            </span>
            <input
              required
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              className={inputClass}
              placeholder="e.g. What are check-in and check-out times?"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-aegean-700 mb-1.5">
              Answer <span className="text-red-500">*</span>
            </span>
            <textarea
              required
              rows={4}
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              className={inputClass}
              placeholder="Your answer for guests"
            />
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <SubmitButton loading={submitting} loadingLabel="Saving..." className="text-sm">
              {editingId ? 'Save changes' : 'Add FAQ'}
            </SubmitButton>
            <AdminModalCancel />
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
