import { useEffect, useState } from 'react';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import { useToast } from '../context/ToastContext';

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.get('/contact/admin').then((r) => setInquiries(r.data)).finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/contact/admin/${id}/read`);
      setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: 1 } : i)));
      toast.success('Marked as read.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-3xl font-serif text-aegean-800 mb-8">Contact Inquiries</h1>
      <div className="space-y-4">
        {inquiries.length === 0 ? (
          <p className="text-aegean-600">No inquiries yet.</p>
        ) : (
          inquiries.map((inq) => (
            <div
              key={inq.id}
              className={`bg-white p-6 rounded-xl shadow-sm ${!inq.is_read ? 'border-l-4 border-aegean-500' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">{inq.name}</p>
                  <p className="text-sm text-aegean-600">{inq.email} · {inq.phone || '—'}</p>
                </div>
                <span className="text-xs text-aegean-500">
                  {new Date(inq.created_at).toLocaleString()}
                </span>
              </div>
              {inq.subject && <p className="text-sm font-medium text-aegean-700 mb-1">{inq.subject}</p>}
              <p className="text-aegean-700/90 whitespace-pre-line">{inq.message}</p>
              {!inq.is_read && (
                <button type="button" onClick={() => markRead(inq.id)} className="mt-3 text-sm text-aegean-600 hover:underline">
                  Mark as read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
