import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, Plus, Printer, Save, Trash2 } from 'lucide-react';
import api, { getApiError } from '../api/client';
import AdminModal from '../components/admin/AdminModal';
import QuotationDocument from '../components/admin/QuotationDocument';
import Loading from '../components/ui/Loading';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { BILAO_PACKAGES, BOODLE_FIGHT_PACKAGES } from '../data/bookingAddOns';
import { ISLAND_HOPPING_RATES } from '../data/islandHoppingRates';
import {
  ADDITIONAL_PAX_LABEL_OPTIONS,
  computeQuotationTotals,
  emptyQuotation,
  emptyQuotationAdditionalPaxLine,
  emptyQuotationBilaoLine,
  emptyQuotationBoat,
  emptyQuotationBoodleLine,
  emptyQuotationRoom,
  formatQuoteAmount,
  normalizeQuotation,
} from '../utils/quotation';
import { openQuotationPrint } from '../utils/openQuotationPrint';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-aegean-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function AdminQuotation() {
  const { id: routeId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const isNewEditor = pathname.endsWith('/quotation/new');
  const isEditor = isNewEditor || Boolean(routeId);

  const [quote, setQuote] = useState(emptyQuotation);
  const [savedId, setSavedId] = useState(routeId && !isNewEditor ? Number(routeId) : null);
  const [referenceCode, setReferenceCode] = useState('');
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [pageLoading, setPageLoading] = useState(Boolean(routeId && !isNewEditor));
  const [listLoading, setListLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [loadRef, setLoadRef] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadLoading, setLoadLoading] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewQuote, setViewQuote] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const loadSavedList = useCallback(() => {
    setListLoading(true);
    return api
      .get('/quotations/admin')
      .then((r) => setSavedQuotes(r.data || []))
      .catch(() => setSavedQuotes([]))
      .finally(() => setListLoading(false));
  }, []);

  const loadSavedQuote = useCallback(async (id) => {
    setPageLoading(true);
    try {
      const { data } = await api.get(`/quotations/admin/${id}`);
      setQuote(normalizeQuotation(data.quote_data));
      setSavedId(data.id);
      setReferenceCode(data.reference_code || '');
    } catch (err) {
      toast.error(getApiError(err));
      navigate('/admin/quotation', { replace: true });
    } finally {
      setPageLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    loadSavedList();
  }, [loadSavedList]);

  useEffect(() => {
    if (isNewEditor) {
      setSavedId(null);
      setReferenceCode('');
      setQuote(emptyQuotation());
      setPageLoading(false);
      return;
    }
    if (routeId) {
      loadSavedQuote(routeId);
      return;
    }
    setSavedId(null);
    setReferenceCode('');
    setPageLoading(false);
  }, [routeId, isNewEditor, loadSavedQuote]);

  useEffect(() => {
    api
      .get('/rooms/admin/all')
      .then((r) => setRooms(r.data || []))
      .catch(() => setRooms([]));
  }, []);

  const totals = useMemo(() => computeQuotationTotals(quote), [quote]);

  const patch = (fields) => setQuote((q) => ({ ...q, ...fields }));

  const patchRoom = (index, fields) => {
    setQuote((q) => {
      const next = [...q.rooms];
      next[index] = { ...next[index], ...fields };
      return { ...q, rooms: next };
    });
  };

  const addRoom = () => {
    setQuote((q) => ({ ...q, rooms: [...q.rooms, emptyQuotationRoom()] }));
  };

  const removeRoom = (index) => {
    setQuote((q) => ({
      ...q,
      rooms: q.rooms.length > 1 ? q.rooms.filter((_, i) => i !== index) : q.rooms,
    }));
  };

  const patchBoat = (index, fields) => {
    setQuote((q) => {
      const next = [...(q.boats || [])];
      next[index] = { ...next[index], ...fields };
      return { ...q, boats: next };
    });
  };

  const addBoat = () => {
    setQuote((q) => ({ ...q, boats: [...(q.boats || []), emptyQuotationBoat()] }));
  };

  const removeBoat = (index) => {
    setQuote((q) => ({
      ...q,
      boats:
        (q.boats || []).length > 1
          ? (q.boats || []).filter((_, i) => i !== index)
          : q.boats || [emptyQuotationBoat()],
    }));
  };

  const patchAdditionalPaxLine = (index, fields) => {
    setQuote((q) => {
      const next = [...(q.additionalPaxLines || [])];
      next[index] = { ...next[index], ...fields };
      return { ...q, additionalPaxLines: next };
    });
  };

  const addAdditionalPaxLine = () => {
    setQuote((q) => ({
      ...q,
      additionalPaxLines: [
        ...(q.additionalPaxLines || []),
        emptyQuotationAdditionalPaxLine(),
      ],
    }));
  };

  const removeAdditionalPaxLine = (index) => {
    setQuote((q) => {
      const lines = q.additionalPaxLines || [];
      return {
        ...q,
        additionalPaxLines:
          lines.length > 1 ? lines.filter((_, i) => i !== index) : [emptyQuotationAdditionalPaxLine()],
      };
    });
  };

  const patchBilaoLine = (index, fields) => {
    setQuote((q) => {
      const next = [...(q.bilaoLines || [])];
      next[index] = { ...next[index], ...fields };
      return { ...q, bilaoLines: next };
    });
  };

  const addBilaoLine = () => {
    setQuote((q) => ({
      ...q,
      bilaoLines: [...(q.bilaoLines || []), emptyQuotationBilaoLine()],
    }));
  };

  const removeBilaoLine = (index) => {
    setQuote((q) => ({
      ...q,
      bilaoLines: (q.bilaoLines || []).filter((_, i) => i !== index),
    }));
  };

  const patchBoodleLine = (index, fields) => {
    setQuote((q) => {
      const next = [...(q.boodleLines || [])];
      next[index] = { ...next[index], ...fields };
      return { ...q, boodleLines: next };
    });
  };

  const addBoodleLine = () => {
    setQuote((q) => ({
      ...q,
      boodleLines: [...(q.boodleLines || []), emptyQuotationBoodleLine()],
    }));
  };

  const removeBoodleLine = (index) => {
    setQuote((q) => ({
      ...q,
      boodleLines: (q.boodleLines || []).filter((_, i) => i !== index),
    }));
  };

  const applyRoomFromList = (index, roomId) => {
    const room = rooms.find((r) => String(r.id) === String(roomId));
    if (!room) return;
    patchRoom(index, {
      roomType: room.name?.toUpperCase() || '',
      rate: room.price_per_night ?? '',
      occupants: room.included_adults ?? room.min_guests ?? 2,
    });
  };

  const loadFromBooking = async (ref) => {
    const code = ref?.trim();
    if (!code) {
      setLoadError('Enter a booking reference code.');
      return;
    }

    setLoadLoading(true);
    setLoadError('');
    try {
      const { data: list } = await api.get('/bookings/admin/all');
      const booking = list.find(
        (b) => b.reference_code?.toUpperCase() === code.toUpperCase()
      );
      if (!booking) {
        setLoadError('Booking not found. Check the reference code and try again.');
        return;
      }
      const detail = (await api.get(`/bookings/admin/${booking.id}`)).data;
      const roomLines =
        detail.room_lines?.length > 0
          ? detail.room_lines.map((line) => ({
              roomType: line.room_name?.toUpperCase() || '',
              occupants: line.guest_count || line.adults || 2,
              rate: line.room_rate || line.subtotal / Math.max(1, line.nights) || '',
              nights: line.nights || detail.nights || 1,
            }))
          : [
              {
                roomType: detail.room_name?.toUpperCase() || '',
                occupants: detail.guest_count || detail.adults || 2,
                rate: detail.room_rate || '',
                nights: detail.nights || 1,
              },
            ];

      const island = detail.island_hopping_data
        ? typeof detail.island_hopping_data === 'string'
          ? JSON.parse(detail.island_hopping_data)
          : detail.island_hopping_data
        : null;

      let tourRegularQty = 0;
      let tourSeniorPwdQty = 0;
      let tourInfantQty = 0;
      if (island?.passengers?.length) {
        island.passengers.forEach((p) => {
          const age = parseInt(p.age, 10);
          if (Number.isFinite(age) && age <= 4) tourInfantQty += 1;
          else if (p.is_pwd || p.is_senior || age >= 60) tourSeniorPwdQty += 1;
          else tourRegularQty += 1;
        });
      }

      const pax = island?.passengers?.length || detail.guest_count || 2;
      const boatTier =
        ISLAND_HOPPING_RATES.boat.find((b) => pax >= b.min && pax <= b.max)?.id || 'small';

      setQuote({
        ...emptyQuotation(),
        rmNo: detail.room_name ? `RM. ${detail.room_name.replace(/\D/g, '').slice(-3) || detail.room_name}` : '',
        dateLabel: `${detail.check_in} – ${detail.check_out}`,
        guestName: detail.guest_name?.toUpperCase() || '',
        bookingPlatform: '',
        pax: detail.guest_count || 2,
        rooms: roomLines,
        additionalPaxLines:
          detail.extra_person_charges > 0
            ? [
                {
                  label: 'Adult',
                  occupants: '',
                  amount: detail.extra_person_charges,
                },
              ]
            : [emptyQuotationAdditionalPaxLine()],
        discountAmount: detail.discount_amount || '',
        discountLabel: detail.discount_code || detail.discount_note || '',
        downPaymentAmount: detail.amount_to_pay < detail.total_amount ? detail.amount_to_pay : '',
        downPaymentLabel:
          detail.amount_to_pay < detail.total_amount ? 'Amount paid / down payment' : '',
        tourEnabled: Boolean(detail.island_hopping),
        tourRegularQty,
        tourSeniorPwdQty,
        tourInfantQty,
        boats: [{ boatTierId: boatTier }],
        bilaoEnabled: Boolean(detail.bilao_package),
        bilaoLines: detail.bilao_package
          ? [{ packageId: detail.bilao_package, qty: 1 }]
          : [],
        boodleEnabled: Boolean(detail.boodle_fight_tier),
        boodleLines: detail.boodle_fight_tier
          ? [{ tierId: detail.boodle_fight_tier, qty: 1 }]
          : [],
      });
      setLoadModalOpen(false);
      setLoadRef('');
      setLoadError('');
    } catch (err) {
      setLoadError(getApiError(err));
    } finally {
      setLoadLoading(false);
    }
  };

  const openLoadModal = () => {
    setLoadRef('');
    setLoadError('');
    setLoadModalOpen(true);
  };

  const openPrint = () => openQuotationPrint(quote);

  const startNewQuote = () => {
    navigate('/admin/quotation/new');
  };

  const backToList = () => {
    navigate('/admin/quotation');
  };

  const saveQuote = async () => {
    const guestLabel = quote.guestName?.trim() || 'this quotation';
    const isEdit = Boolean(savedId);
    const ok = await confirm({
      title: isEdit ? 'Save quotation changes?' : 'Save quotation?',
      message: isEdit
        ? `Update the saved quote for ${guestLabel}?`
        : `Save ${guestLabel} so you can edit or reprint it later?`,
      confirmLabel: isEdit ? 'Yes, save' : 'Yes, save quote',
    });
    if (!ok) return;

    setSaving(true);
    try {
      const payload = {
        quote_data: quote,
        grand_total: totals.grandTotal,
        guest_name: quote.guestName?.trim() || 'Untitled quote',
      };
      if (isEdit) {
        await api.put(`/quotations/admin/${savedId}`, payload);
        toast.success('Quotation updated.');
        loadSavedList();
      } else {
        const { data } = await api.post('/quotations/admin', payload);
        setSavedId(data.id);
        setReferenceCode(data.reference_code || '');
        toast.success('Quotation saved.');
        loadSavedList();
        navigate(`/admin/quotation/${data.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteSavedQuote = async () => {
    if (!savedId) return;
    await deleteQuote({
      id: savedId,
      reference_code: referenceCode,
      guest_name: quote.guestName,
    });
  };

  const deleteQuote = async (item) => {
    const ok = await confirm({
      title: 'Delete quotation?',
      message: item.reference_code
        ? `${item.reference_code}${item.guest_name ? ` for ${item.guest_name}` : ''} will be permanently deleted.`
        : 'This saved quotation will be permanently deleted.',
      confirmLabel: 'Yes, delete',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/quotations/admin/${item.id}`);
      toast.success('Quotation deleted.');
      if (viewQuote?.id === item.id) closeViewModal();
      if (savedId === item.id && isEditor) backToList();
      loadSavedList();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const openViewQuote = async (item) => {
    setViewModalOpen(true);
    setViewLoading(true);
    setViewQuote(null);
    try {
      const { data } = await api.get(`/quotations/admin/${item.id}`);
      setViewQuote({
        ...data,
        quote_data: normalizeQuotation(data.quote_data),
      });
    } catch (err) {
      toast.error(getApiError(err));
      setViewModalOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  const closeViewModal = () => {
    setViewModalOpen(false);
    setViewQuote(null);
    setViewLoading(false);
  };

  const openSavedQuote = (item) => {
    navigate(`/admin/quotation/${item.id}`);
  };

  if (pageLoading) return <Loading />;

  const viewQuoteModal = (
    <AdminModal
      open={viewModalOpen}
      onClose={closeViewModal}
      title={viewQuote?.reference_code ? `Quotation ${viewQuote.reference_code}` : 'View quotation'}
      description={
        viewQuote?.guest_name
          ? `${viewQuote.guest_name} · ₱${formatQuoteAmount(viewQuote.grand_total)}`
          : 'Read-only preview of the saved quotation.'
      }
      size="xl"
    >
      {viewLoading ? (
        <Loading />
      ) : viewQuote?.quote_data ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-aegean-100 p-4 bg-white">
            <QuotationDocument quote={viewQuote.quote_data} />
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => openQuotationPrint(viewQuote.quote_data)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aegean-600 text-white text-sm hover:bg-aegean-700"
            >
              <Printer size={16} /> Print / PDF
            </button>
            <button
              type="button"
              onClick={() => {
                closeViewModal();
                openSavedQuote(viewQuote);
              }}
              className="px-4 py-2 rounded-lg border border-aegean-200 text-sm hover:bg-aegean-50"
            >
              Edit quotation
            </button>
          </div>
        </div>
      ) : null}
    </AdminModal>
  );

  const savedListSection = (
    <section className="bg-white rounded-xl border border-aegean-100 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-medium text-aegean-800">Saved quotations</h2>
          <p className="text-xs text-aegean-500 mt-1">
            Open a saved quote to edit, reprint, or delete it.
          </p>
        </div>
      </div>
      {listLoading ? (
        <p className="text-sm text-aegean-500">Loading saved quotes…</p>
      ) : savedQuotes.length === 0 ? (
        <p className="text-sm text-aegean-500">No saved quotations yet. Click New quote to create one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-aegean-600 border-b border-aegean-100">
                <th className="py-2 pr-3 font-medium">Reference</th>
                <th className="py-2 pr-3 font-medium">Guest</th>
                <th className="py-2 pr-3 font-medium">Total</th>
                <th className="py-2 pr-3 font-medium">Updated</th>
                <th className="py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {savedQuotes.map((item) => (
                <tr key={item.id} className="border-b border-aegean-50">
                  <td className="py-2.5 pr-3 font-mono text-xs">{item.reference_code}</td>
                  <td className="py-2.5 pr-3">{item.guest_name || '—'}</td>
                  <td className="py-2.5 pr-3">₱{formatQuoteAmount(item.grand_total)}</td>
                  <td className="py-2.5 pr-3 text-aegean-500">
                    {item.updated_at ? new Date(item.updated_at).toLocaleString() : '—'}
                  </td>
                  <td className="py-2.5 text-right">
                    <IconActionGroup className="justify-end">
                      <IconActionButton
                        icon={Eye}
                        label="View quotation"
                        onClick={() => openViewQuote(item)}
                      />
                      <IconActionButton
                        icon={Pencil}
                        label="Edit quotation"
                        onClick={() => openSavedQuote(item)}
                      />
                      <IconActionButton
                        icon={Trash2}
                        label="Delete quotation"
                        className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                        onClick={() => deleteQuote(item)}
                      />
                    </IconActionGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  if (!isEditor) {
    return (
      <div className="admin-quotation-page">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif text-aegean-800">Quotations</h1>
            <p className="text-sm text-aegean-600 mt-1">
              Create a new quote or open a saved one to edit or print.
            </p>
          </div>
          <button
            type="button"
            onClick={startNewQuote}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aegean-600 text-white text-sm hover:bg-aegean-700"
          >
            <Plus size={16} /> New quote
          </button>
        </div>

        {savedListSection}
        {viewQuoteModal}
      </div>
    );
  }

  return (
    <div className="admin-quotation-page">
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          .no-print { display: none !important; }
          .admin-quotation-page { padding: 0 !important; margin: 0 !important; }
          .quotation-preview {
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          html, body { background: white !important; }
          .quotation-doc, .quotation-doc * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-1 text-sm text-aegean-600 hover:text-aegean-800 mb-2"
          >
            <ArrowLeft size={16} /> Back to quotations
          </button>
          <h1 className="text-2xl font-serif text-aegean-800">
            {savedId ? 'Edit quotation' : 'New quotation'}
          </h1>
          <p className="text-sm text-aegean-600 mt-1">
            Build the quote, save it, then print or share as PDF.
          </p>
          {referenceCode && (
            <p className="text-xs text-aegean-500 mt-1 font-mono">{referenceCode}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openLoadModal}
            className="px-4 py-2 rounded-lg border border-aegean-200 text-sm hover:bg-aegean-50"
          >
            Load from booking
          </button>
          <button
            type="button"
            onClick={saveQuote}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-aegean-300 bg-aegean-50 text-aegean-800 text-sm hover:bg-aegean-100 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Saving…' : savedId ? 'Save changes' : 'Save quote'}
          </button>
          {savedId && (
            <button
              type="button"
              onClick={deleteSavedQuote}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm hover:bg-red-50"
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => setQuote(emptyQuotation())}
            className="px-4 py-2 rounded-lg border border-aegean-200 text-sm hover:bg-aegean-50"
          >
            Clear form
          </button>
          <button
            type="button"
            onClick={openPrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aegean-600 text-white text-sm hover:bg-aegean-700"
          >
            <Printer size={16} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-8 items-start">
        <div className="no-print space-y-6">
          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-4">
            <h2 className="font-medium text-aegean-800">Guest & stay</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="RM No.">
                <input
                  className={inputClass}
                  value={quote.rmNo}
                  onChange={(e) => patch({ rmNo: e.target.value })}
                  placeholder="RM. 302"
                />
              </Field>
              <Field label="Date (display)">
                <input
                  className={inputClass}
                  value={quote.dateLabel}
                  onChange={(e) => patch({ dateLabel: e.target.value })}
                  placeholder="May 22–24, 2026"
                />
              </Field>
              <Field label="Guest name">
                <input
                  className={inputClass}
                  value={quote.guestName}
                  onChange={(e) => patch({ guestName: e.target.value })}
                />
              </Field>
              <Field label="Booking platform">
                <input
                  className={inputClass}
                  value={quote.bookingPlatform}
                  onChange={(e) => patch({ bookingPlatform: e.target.value })}
                  placeholder="FB, Airbnb, Walk-in…"
                />
              </Field>
              <Field label="Pax">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={quote.pax}
                  onChange={(e) => patch({ pax: e.target.value })}
                />
              </Field>
              <Field label="Check-in time">
                <input
                  className={inputClass}
                  value={quote.checkInTime}
                  onChange={(e) => patch({ checkInTime: e.target.value })}
                />
              </Field>
              <Field label="Check-out time">
                <input
                  className={inputClass}
                  value={quote.checkOutTime}
                  onChange={(e) => patch({ checkOutTime: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium text-aegean-800">Accommodation</h2>
              <button
                type="button"
                onClick={addRoom}
                className="inline-flex items-center gap-1 text-xs text-aegean-600 hover:text-aegean-800"
              >
                <Plus size={14} /> Add room
              </button>
            </div>
            {quote.rooms.map((row, index) => (
              <div key={index} className="rounded-lg border border-aegean-100 p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-aegean-600">Room {index + 1}</p>
                  {quote.rooms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRoom(index)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Remove room"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {rooms.length > 0 && (
                  <Field label="Fill from room list">
                    <select
                      className={inputClass}
                      value=""
                      onChange={(e) => applyRoomFromList(index, e.target.value)}
                    >
                      <option value="">Select room…</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} — ₱{Number(r.price_per_night).toLocaleString()}/night
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Room type">
                    <input
                      className={inputClass}
                      value={row.roomType}
                      onChange={(e) => patchRoom(index, { roomType: e.target.value })}
                      placeholder="COUPLE ROOM"
                    />
                  </Field>
                  <Field label="Occupants">
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={row.occupants}
                      onChange={(e) => patchRoom(index, { occupants: e.target.value })}
                    />
                  </Field>
                  <Field label="Rate / night (₱)">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={inputClass}
                      value={row.rate}
                      onChange={(e) => patchRoom(index, { rate: e.target.value })}
                    />
                  </Field>
                  <Field label="Nights">
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={row.nights}
                      onChange={(e) => patchRoom(index, { nights: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="text-xs text-aegean-500">
                  Line total: ₱
                  {formatQuoteAmount(
                    (parseFloat(row.rate) || 0) * (parseInt(row.nights, 10) || 1)
                  )}
                </p>
              </div>
            ))}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-aegean-600">Additional pax</p>
                <button
                  type="button"
                  onClick={addAdditionalPaxLine}
                  className="inline-flex items-center gap-1 text-xs text-aegean-600 hover:text-aegean-800"
                >
                  <Plus size={14} /> Add additional pax
                </button>
              </div>
              {(quote.additionalPaxLines || []).map((paxRow, index) => (
                <div
                  key={`additional-pax-${index}`}
                  className="rounded-lg border border-aegean-100 p-3 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-medium text-aegean-600">
                      Additional pax {index + 1}
                    </p>
                    {(quote.additionalPaxLines || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAdditionalPaxLine(index)}
                        className="text-red-600 hover:text-red-700"
                        aria-label="Remove additional pax line"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Field label="Type">
                      <select
                        className={inputClass}
                        value={
                          ADDITIONAL_PAX_LABEL_OPTIONS.includes(paxRow.label)
                            ? paxRow.label
                            : 'Adult'
                        }
                        onChange={(e) => patchAdditionalPaxLine(index, { label: e.target.value })}
                      >
                        {ADDITIONAL_PAX_LABEL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="No. of additional pax">
                      <input
                        type="number"
                        min={0}
                        className={inputClass}
                        value={paxRow.occupants}
                        onChange={(e) =>
                          patchAdditionalPaxLine(index, { occupants: e.target.value })
                        }
                        placeholder="Optional"
                      />
                    </Field>
                    <Field label="Amount (₱)">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={inputClass}
                        value={paxRow.amount}
                        onChange={(e) =>
                          patchAdditionalPaxLine(index, { amount: e.target.value })
                        }
                        placeholder="Manual total"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-aegean-100">
              <Field label="Discount label">
                <input
                  className={inputClass}
                  value={quote.discountLabel}
                  onChange={(e) => patch({ discountLabel: e.target.value })}
                  placeholder="Anniversary promo"
                />
              </Field>
              <Field label="Discount amount (₱)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={quote.discountAmount}
                  onChange={(e) => patch({ discountAmount: e.target.value })}
                />
              </Field>
              <Field label="Down payment label">
                <input
                  className={inputClass}
                  value={quote.downPaymentLabel}
                  onChange={(e) => patch({ downPaymentLabel: e.target.value })}
                  placeholder="Down payment via BPI…"
                />
              </Field>
              <Field label="Down payment (₱)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={quote.downPaymentAmount}
                  onChange={(e) => patch({ downPaymentAmount: e.target.value })}
                />
              </Field>
            </div>
            <p className="text-sm font-medium text-aegean-800">
              Accommodation balance: ₱{formatQuoteAmount(totals.accommodation.balance)}
            </p>
          </section>

          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-aegean-800">
              <input
                type="checkbox"
                checked={quote.tourEnabled}
                onChange={(e) => patch({ tourEnabled: e.target.checked })}
              />
              Include Hundred Islands tour
            </label>
            {quote.tourEnabled && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Regular entrance (5–59) — qty">
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={quote.tourRegularQty}
                      onChange={(e) => patch({ tourRegularQty: e.target.value })}
                    />
                  </Field>
                  <Field label="Senior / PWD — qty">
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={quote.tourSeniorPwdQty}
                      onChange={(e) => patch({ tourSeniorPwdQty: e.target.value })}
                    />
                  </Field>
                  <Field label="Infant (0–4) — qty">
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={quote.tourInfantQty}
                      onChange={(e) => patch({ tourInfantQty: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="space-y-3 pt-2 border-t border-aegean-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-aegean-800">Boats</p>
                    <button
                      type="button"
                      onClick={addBoat}
                      className="inline-flex items-center gap-1 text-xs text-aegean-600 hover:text-aegean-800"
                    >
                      <Plus size={14} /> Add boat
                    </button>
                  </div>
                  {(quote.boats || []).map((boatRow, index) => (
                    <div
                      key={`boat-${index}`}
                      className="rounded-lg border border-aegean-100 p-3 space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-medium text-aegean-600">Boat {index + 1}</p>
                        {(quote.boats || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBoat(index)}
                            className="text-red-600 hover:text-red-700"
                            aria-label="Remove boat"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <Field label="Boat size">
                        <select
                          className={inputClass}
                          value={boatRow.boatTierId}
                          onChange={(e) => patchBoat(index, { boatTierId: e.target.value })}
                        >
                          {ISLAND_HOPPING_RATES.boat.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.label} — ₱{b.rate.toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  ))}
                </div>
              </>
            )}
            {quote.tourEnabled && (
              <p className="text-sm font-medium text-aegean-800">
                Tour total: ₱{formatQuoteAmount(totals.tour.total)}
              </p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-aegean-800">
                <input
                  type="checkbox"
                  checked={Boolean(quote.bilaoEnabled)}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    patch({
                      bilaoEnabled: enabled,
                      bilaoLines:
                        enabled && !(quote.bilaoLines || []).length
                          ? [emptyQuotationBilaoLine()]
                          : quote.bilaoLines,
                    });
                  }}
                />
                Include seafood bilao
              </label>
              {quote.bilaoEnabled && (
                <button
                  type="button"
                  onClick={addBilaoLine}
                  className="inline-flex items-center gap-1 text-xs text-aegean-600 hover:text-aegean-800"
                >
                  <Plus size={14} /> Add bilao
                </button>
              )}
            </div>
            {quote.bilaoEnabled && (
              <>
                {(quote.bilaoLines || []).length === 0 && (
                  <p className="text-xs text-aegean-500">No bilao orders added.</p>
                )}
                {(quote.bilaoLines || []).map((line, index) => (
                  <div
                    key={`bilao-${index}`}
                    className="rounded-lg border border-aegean-100 p-3 grid sm:grid-cols-[1fr_100px_auto] gap-3 items-end"
                  >
                    <Field label="Package">
                      <select
                        className={inputClass}
                        value={line.packageId}
                        onChange={(e) => patchBilaoLine(index, { packageId: e.target.value })}
                      >
                        <option value="">Select…</option>
                        {BILAO_PACKAGES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} ({p.pax} pax) — ₱{p.price.toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Qty">
                      <input
                        type="number"
                        min={1}
                        className={inputClass}
                        value={line.qty}
                        onChange={(e) => patchBilaoLine(index, { qty: e.target.value })}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => removeBilaoLine(index)}
                      className="text-red-600 hover:text-red-700 p-2 mb-0.5"
                      aria-label="Remove bilao"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {totals.bilao.total > 0 && (
                  <p className="text-sm text-aegean-600">
                    Seafood bilao total: ₱{formatQuoteAmount(totals.bilao.total)}
                  </p>
                )}
              </>
            )}
          </section>

          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-aegean-800">
                <input
                  type="checkbox"
                  checked={Boolean(quote.boodleEnabled)}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    patch({
                      boodleEnabled: enabled,
                      boodleLines:
                        enabled && !(quote.boodleLines || []).length
                          ? [emptyQuotationBoodleLine()]
                          : quote.boodleLines,
                    });
                  }}
                />
                Include boodle fight
              </label>
              {quote.boodleEnabled && (
                <button
                  type="button"
                  onClick={addBoodleLine}
                  className="inline-flex items-center gap-1 text-xs text-aegean-600 hover:text-aegean-800"
                >
                  <Plus size={14} /> Add boodle fight
                </button>
              )}
            </div>
            {quote.boodleEnabled && (
              <>
                {(quote.boodleLines || []).length === 0 && (
                  <p className="text-xs text-aegean-500">No boodle fight orders added.</p>
                )}
                {(quote.boodleLines || []).map((line, index) => (
                  <div
                    key={`boodle-${index}`}
                    className="rounded-lg border border-aegean-100 p-3 grid sm:grid-cols-[1fr_100px_auto] gap-3 items-end"
                  >
                    <Field label="Group size">
                      <select
                        className={inputClass}
                        value={line.tierId}
                        onChange={(e) => patchBoodleLine(index, { tierId: e.target.value })}
                      >
                        <option value="">Select…</option>
                        {BOODLE_FIGHT_PACKAGES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} — ₱{p.price.toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Qty">
                      <input
                        type="number"
                        min={1}
                        className={inputClass}
                        value={line.qty}
                        onChange={(e) => patchBoodleLine(index, { qty: e.target.value })}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => removeBoodleLine(index)}
                      className="text-red-600 hover:text-red-700 p-2 mb-0.5"
                      aria-label="Remove boodle fight"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {totals.boodleFight.total > 0 && (
                  <p className="text-sm text-aegean-600">
                    Boodle fight total: ₱{formatQuoteAmount(totals.boodleFight.total)}
                  </p>
                )}
              </>
            )}
          </section>

          <p className="text-lg font-serif text-aegean-800">
            Grand total: ₱{formatQuoteAmount(totals.grandTotal)}
          </p>
        </div>

        <div className="quotation-preview bg-white rounded-xl border border-aegean-100 p-4 sm:p-6 shadow-sm print:border-0 print:shadow-none print:p-0">
          <p className="no-print text-xs text-aegean-500 mb-3 uppercase tracking-wide">Preview</p>
          <QuotationDocument quote={quote} />
        </div>
      </div>

      <p className="no-print text-xs text-aegean-500 mt-6">
        Tip: <strong>Print / PDF</strong> opens the printable page (new tab if allowed, otherwise this tab).
        Enable <strong>Background graphics</strong> for colors. Use <strong>Back to quotation</strong> when
        done.{' '}
        <Link to="/admin/bookings" className="underline">
          Back to bookings
        </Link>
      </p>

      <AdminModal
        open={loadModalOpen}
        onClose={() => {
          if (!loadLoading) setLoadModalOpen(false);
        }}
        title="Load from booking"
        description="Enter the guest's booking reference code to pre-fill this quotation."
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadFromBooking(loadRef);
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="load-booking-ref" className="block text-sm font-medium text-aegean-800 mb-1">
              Reference code
            </label>
            <input
              id="load-booking-ref"
              type="text"
              className={inputClass}
              value={loadRef}
              onChange={(e) => {
                setLoadRef(e.target.value);
                if (loadError) setLoadError('');
              }}
              placeholder="CB-20260627-8B0C"
              autoFocus
              disabled={loadLoading}
            />
          </div>
          {loadError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {loadError}
            </p>
          )}
          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setLoadModalOpen(false)}
              disabled={loadLoading}
              className="px-4 py-2 rounded-lg border border-aegean-200 text-sm hover:bg-aegean-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loadLoading || !loadRef.trim()}
              className="px-4 py-2 rounded-lg bg-aegean-600 text-white text-sm hover:bg-aegean-700 disabled:opacity-50"
            >
              {loadLoading ? 'Loading…' : 'Load booking'}
            </button>
          </div>
        </form>
      </AdminModal>

      {viewQuoteModal}
    </div>
  );
}
