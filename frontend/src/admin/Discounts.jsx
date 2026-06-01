import { useEffect, useState } from 'react';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';

export default function AdminDiscounts() {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const [form, setForm] = useState({
    code: '', description: '', type: 'percentage', value: 10, min_nights: 1,
  });

  const load = () => api.get('/admin/discounts').then((r) => setDiscounts(r.data)).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/discounts', form);
      setForm({ code: '', description: '', type: 'percentage', value: 10, min_nights: 1 });
      load();
      toast.success('Discount created.');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (id, is_active) => {
    try {
      await api.patch(`/admin/discounts/${id}`, { is_active: !is_active });
      load();
      toast.success(is_active ? 'Discount deactivated.' : 'Discount activated.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-serif text-aegean-800 mb-8">Discounts</h1>

      <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-sm mb-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required className="border rounded-lg px-3 py-2" />
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border rounded-lg px-3 py-2" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="border rounded-lg px-3 py-2">
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed (PHP)</option>
        </select>
        <input type="number" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: +e.target.value })} className="border rounded-lg px-3 py-2" />
        <SubmitButton loading={submitting} loadingLabel="Adding...">
          Add Discount
        </SubmitButton>
      </form>

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-3">
          {discounts.map((d) => (
            <div key={d.id} className="bg-white p-4 rounded-xl flex justify-between items-center">
              <div>
                <span className="font-mono font-medium">{d.code}</span>
                <span className="text-aegean-600 text-sm ml-3">
                  {d.type === 'percentage' ? `${d.value}%` : `₱${d.value}`} off
                </span>
              </div>
              <button type="button" onClick={() => toggle(d.id, d.is_active)} className="text-sm text-aegean-600">
                {d.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
