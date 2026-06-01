import { useEffect, useState } from 'react';
import api, { getApiError } from '../api/client';
import { getAssetUrl } from '../utils/assetUrl';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';

export default function AdminPaymentMethods() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();

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

  const updateField = (id, field, value) => {
    setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const save = async (method) => {
    setSaving(method.id);
    setError('');
    try {
      const form = new FormData();
      form.append('name', method.name);
      form.append('account_name', method.account_name || '');
      form.append('account_number', method.account_number || '');
      form.append('instructions', method.instructions || '');
      form.append('is_active', method.is_active ? '1' : '0');
      if (method._qrFile) form.append('qr', method._qrFile);

      const { data } = await api.put(`/payment-methods/admin/${method.id}`, form);
      setMethods((prev) => prev.map((m) => (m.id === data.id ? { ...data, _qrFile: null } : m)));
      toast.success(`${method.name} saved.`);
    } catch (e) {
      const msg = getApiError(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-3xl font-serif text-aegean-800 mb-2">Payment Methods</h1>
      <p className="text-aegean-600 text-sm mb-8">Manage QR codes and instructions for GCash, Maya, and bank transfers.</p>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-6">
        {methods.map((m) => (
          <div key={m.id} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-medium text-lg text-aegean-800">{m.name}</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!m.is_active}
                  onChange={(e) => updateField(m.id, 'is_active', e.target.checked ? 1 : 0)}
                />
                Active
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Account name"
                value={m.account_name || ''}
                onChange={(e) => updateField(m.id, 'account_name', e.target.value)}
              />
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Account number"
                value={m.account_number || ''}
                onChange={(e) => updateField(m.id, 'account_number', e.target.value)}
              />
            </div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={2}
              placeholder="Payment instructions"
              value={m.instructions || ''}
              onChange={(e) => updateField(m.id, 'instructions', e.target.value)}
            />

            <div className="flex flex-wrap items-center gap-6">
              {m.qr_image_url && (
                <img src={getAssetUrl(m.qr_image_url)} alt="QR" className="w-32 h-32 object-contain border rounded-lg" />
              )}
              <label className="text-sm text-aegean-600 cursor-pointer">
                <span className="btn-outline text-sm py-2 px-4 inline-block">Upload QR Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) updateField(m.id, '_qrFile', file);
                  }}
                />
                {m._qrFile && <span className="block mt-1 text-xs">{m._qrFile.name}</span>}
              </label>
            </div>

            <SubmitButton
              type="button"
              onClick={() => save(m)}
              loading={saving === m.id}
              loadingLabel="Saving..."
              className="text-sm py-2 px-5"
            >
              Save
            </SubmitButton>
          </div>
        ))}
      </div>
    </div>
  );
}
