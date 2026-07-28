import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import api, { getApiError } from '../api/client';
import Loading from '../components/ui/Loading';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Pagination from '../components/ui/Pagination';
import AdminTableShell from '../components/ui/AdminTableShell';
import { usePagination } from '../hooks/usePagination';
import { formatDateTimePHT } from '../utils/datetime';

function formatInquiryDate(value) {
  return formatDateTimePHT(value);
}

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const confirm = useConfirm();
  const { page, setPage, pageItems, totalPages, totalItems, from, to } = usePagination(inquiries);

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

  const deleteInquiry = async (inq) => {
    const ok = await confirm({
      title: 'Delete inquiry?',
      message: `Remove the message from ${inq.name}? This cannot be undone.`,
      confirmLabel: 'Yes, delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/contact/admin/${inq.id}`);
      setInquiries((prev) => prev.filter((i) => i.id !== inq.id));
      toast.success('Inquiry deleted.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-serif text-aegean-800 mb-8">Contact Inquiries</h1>

      {inquiries.length === 0 ? (
        <p className="text-aegean-600">No inquiries yet.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-aegean-100 overflow-hidden">
          {inquiries.length === 0 ? null : (
            <div className="lg:hidden p-4 space-y-3">
              {pageItems.map((inq) => (
                <article
                  key={inq.id}
                  className={`rounded-xl border p-4 space-y-3 ${
                    !inq.is_read ? 'border-aegean-200 bg-aegean-50/50' : 'border-aegean-100 bg-white'
                  }`}
                >
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="text-aegean-500">{formatInquiryDate(inq.created_at)}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium ${
                        inq.is_read ? 'bg-gray-100 text-gray-600' : 'bg-aegean-100 text-aegean-700'
                      }`}
                    >
                      {inq.is_read ? 'Read' : 'New'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-aegean-900">{inq.name}</p>
                    <p className="text-xs text-aegean-500 break-all">{inq.email}</p>
                    {inq.phone && <p className="text-xs text-aegean-500">{inq.phone}</p>}
                  </div>
                  {inq.subject && (
                    <p className="text-sm text-aegean-700">
                      <span className="text-aegean-500">Subject:</span> {inq.subject}
                    </p>
                  )}
                  <p className="text-sm text-aegean-700 whitespace-pre-line">{inq.message}</p>
                  <IconActionGroup>
                    {!inq.is_read && (
                      <IconActionButton
                        icon={Check}
                        label="Mark as read"
                        onClick={() => markRead(inq.id)}
                      />
                    )}
                    <IconActionButton
                      icon={Trash2}
                      label="Delete inquiry"
                      className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                      onClick={() => deleteInquiry(inq)}
                    />
                  </IconActionGroup>
                </article>
              ))}
            </div>
          )}

          <AdminTableShell>
            <thead className="bg-aegean-50">
              <tr>
                <th className="text-left p-4 whitespace-nowrap">Date</th>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Contact</th>
                <th className="text-left p-4">Subject</th>
                <th className="text-left p-4 min-w-[200px]">Message</th>
                <th className="text-left p-4 whitespace-nowrap">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.length > 0 &&
                pageItems.map((inq) => (
                  <tr
                    key={inq.id}
                    className={`border-t ${!inq.is_read ? 'bg-aegean-50/40' : ''}`}
                  >
                    <td className="p-4 text-aegean-600 whitespace-nowrap text-xs">
                      {formatInquiryDate(inq.created_at)}
                    </td>
                    <td className="p-4 font-medium text-aegean-800">{inq.name}</td>
                    <td className="p-4">
                      <p className="text-aegean-800">{inq.email}</p>
                      <p className="text-xs text-aegean-500">{inq.phone || '—'}</p>
                    </td>
                    <td className="p-4 text-aegean-700">{inq.subject || '—'}</td>
                    <td className="p-4 text-aegean-700/90">
                      <p className="line-clamp-3 whitespace-pre-line" title={inq.message}>
                        {inq.message}
                      </p>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                          inq.is_read
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-aegean-100 text-aegean-700'
                        }`}
                      >
                        {inq.is_read ? 'Read' : 'New'}
                      </span>
                    </td>
                    <td className="p-4">
                      <IconActionGroup>
                        {!inq.is_read && (
                          <IconActionButton
                            icon={Check}
                            label="Mark as read"
                            onClick={() => markRead(inq.id)}
                          />
                        )}
                        <IconActionButton
                          icon={Trash2}
                          label="Delete inquiry"
                          className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                          onClick={() => deleteInquiry(inq)}
                        />
                      </IconActionGroup>
                    </td>
                  </tr>
                ))}
            </tbody>
          </AdminTableShell>
          {inquiries.length > 0 && (
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
      )}
    </div>
  );
}
