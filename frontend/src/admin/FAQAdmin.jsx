import { useEffect, useState } from 'react';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';

export default function AdminFAQ() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '', category: 'general' });
  const [error, setError] = useState('');
  const toast = useToast();

  const load = () => api.get('/faqs').then((r) => setFaqs(r.data)).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/faqs/admin', form);
      setForm({ question: '', answer: '', category: 'general' });
      load();
      toast.success('FAQ added.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (faq) => {
    try {
      await api.put(`/faqs/admin/${faq.id}`, { ...faq, is_active: faq.is_active ? 0 : 1 });
      load();
      toast.success(faq.is_active ? 'FAQ deactivated.' : 'FAQ activated.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-3xl font-serif text-aegean-800 mb-8">FAQ Management</h1>
      <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl shadow-sm mb-8 space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input required placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
        <textarea required placeholder="Answer" rows={3} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
        <SubmitButton loading={submitting} loadingLabel="Adding..." className="text-sm">
          Add FAQ
        </SubmitButton>
      </form>
      <div className="space-y-3">
        {faqs.map((faq) => (
          <div key={faq.id} className="bg-white p-4 rounded-xl flex justify-between gap-4">
            <div>
              <p className="font-medium">{faq.question}</p>
              <p className="text-sm text-aegean-600 mt-1 line-clamp-2">{faq.answer}</p>
            </div>
            <button type="button" onClick={() => toggle(faq)} className="text-sm text-aegean-600 shrink-0">Deactivate</button>
          </div>
        ))}
      </div>
    </div>
  );
}
