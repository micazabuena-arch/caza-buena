import { useEffect, useState } from 'react';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';

export default function AdminPolicies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    api.get('/policies').then((r) => setPolicies(r.data)).finally(() => setLoading(false));
  }, []);

  const save = async (policy) => {
    setSaving(policy.id);
    setError('');
    try {
      await api.put(`/policies/admin/${policy.id}`, {
        title: policy.title,
        content: policy.content,
        is_active: 1,
      });
      toast.success('Policy saved.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-3xl font-serif text-aegean-800 mb-8">Policies</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="space-y-6">
        {policies.map((p) => (
          <div key={p.id} className="bg-white p-6 rounded-xl shadow-sm space-y-3">
            <input
              className="w-full border rounded-lg px-3 py-2 font-medium"
              value={p.title}
              onChange={(e) => setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)))}
            />
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={5}
              value={p.content}
              onChange={(e) => setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, content: e.target.value } : x)))}
            />
            <SubmitButton
              type="button"
              onClick={() => save(p)}
              loading={saving === p.id}
              loadingLabel="Saving..."
              className="text-sm py-2 px-4"
            >
              Save
            </SubmitButton>
          </div>
        ))}
      </div>
    </div>
  );
}
