import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, Plus, Printer, Save, Trash2 } from 'lucide-react';
import api, { getApiError } from '../api/client';
import AdminModal from '../components/admin/AdminModal';
import QuotationDocument from '../components/admin/QuotationDocument';
import Loading from '../components/ui/Loading';
import Pagination from '../components/ui/Pagination';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import AdminListFilters from '../components/ui/AdminListFilters';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { useFilteredPagination } from '../hooks/useAdminListFilter';
import { toDateKey } from '../utils/adminListFilter';
import { ISLAND_HOPPING_RATES } from '../data/islandHoppingRates';
import { islandHoppingRatesFromSettings } from '../utils/islandHoppingRatesConfig';
import { defaultFoodAddOnRates, foodAddOnRatesFromSettings } from '../utils/foodAddOnRatesConfig';
import { EXTRA_PERSON_RATES } from '../data/resortRules';
import {
  ADDITIONAL_PAX_LABEL_OPTIONS,
  CUSTOM_ADDON_LABEL_SUGGESTIONS,
  computeQuotationTotals,
  describeAdditionalPaxLine,
  clampAdditionalPaxLineNights,
  describeQuotationDateRange,
  emptyQuotation,
  emptyQuotationAdditionalPaxLine,
  emptyQuotationBilaoLine,
  emptyQuotationBoat,
  emptyQuotationBoodleLine,
  emptyQuotationCustomAddonLine,
  emptyQuotationRoom,
  formatQuoteAmount,
  formatRoomListOptionLabel,
  getAdditionalPaxContext,
  getQuotationCheckIn,
  getQuotedRoomNightlyRate,
  getQuotationStayNights,
  normalizeQuotation,
  parseQuotationDateRange,
} from '../utils/quotation';
import { openQuotationPrint } from '../utils/openQuotationPrint';
import { formatDateTimePHT } from '../utils/datetime';
import { format } from 'date-fns';
import { useDirtySnapshot, useUnsavedNavigation } from '../hooks/useConfirmLeave';

const QUOTE_SEARCH_FIELDS = ['reference_code', 'guest_name'];

function quoteUpdatedDate(item) {
  return toDateKey(item.updated_at || item.created_at);
}

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
  const [extraPersonRates, setExtraPersonRates] = useState(EXTRA_PERSON_RATES);
  const [islandHoppingRates, setIslandHoppingRates] = useState(ISLAND_HOPPING_RATES);
  const [foodAddOnRates, setFoodAddOnRates] = useState(defaultFoodAddOnRates);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewQuote, setViewQuote] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [quoteBaselineKey, setQuoteBaselineKey] = useState(0);

  const {
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    filtered: filteredQuotes,
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems,
    from,
    to,
  } = useFilteredPagination(savedQuotes, {
    searchFields: QUOTE_SEARCH_FIELDS,
    getDate: quoteUpdatedDate,
  });
  const quoteDirty = useDirtySnapshot(quote, isEditor, quoteBaselineKey);
  useUnsavedNavigation(quoteDirty);

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
      setQuoteBaselineKey((n) => n + 1);
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
      setQuoteBaselineKey((n) => n + 1);
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
    Promise.all([api.get('/rooms/admin/all'), api.get('/settings/public')])
      .then(([roomsRes, settingsRes]) => {
        setRooms(roomsRes.data || []);
        if (settingsRes.data?.extra_person_rates) {
          setExtraPersonRates(settingsRes.data.extra_person_rates);
        }
        if (settingsRes.data?.island_hopping_rates) {
          setIslandHoppingRates(islandHoppingRatesFromSettings(settingsRes.data));
        }
        if (settingsRes.data?.food_add_on_rates) {
          setFoodAddOnRates(foodAddOnRatesFromSettings(settingsRes.data));
        }
      })
      .catch(() => {
        setRooms([]);
      });
  }, []);

  const paxContext = useMemo(
    () => getAdditionalPaxContext(quote, { extraPersonRates }),
    [quote, extraPersonRates]
  );

  const totals = useMemo(
    () =>
      computeQuotationTotals(quote, {
        extraPersonRates,
        islandHoppingRates,
        foodAddOnRates,
      }),
    [quote, extraPersonRates, islandHoppingRates, foodAddOnRates]
  );
  const stayNights = useMemo(() => getQuotationStayNights(quote), [quote]);
  const dateRangePreview = useMemo(
    () => describeQuotationDateRange(quote.dateLabel),
    [quote.dateLabel]
  );

  const patchDateLabel = (dateLabel) => {
    const preview = describeQuotationDateRange(dateLabel);
    const range = parseQuotationDateRange(dateLabel);
    const nights = preview?.nights ?? 1;
    const checkIn = range ? format(range.start, 'yyyy-MM-dd') : '';
    setQuote((q) => ({
      ...q,
      dateLabel,
      checkIn: range ? format(range.start, 'yyyy-MM-dd') : q.checkIn,
      checkOut: range ? format(range.end, 'yyyy-MM-dd') : q.checkOut,
      nights,
      rooms: (q.rooms || []).map((row) => {
        const next = { ...row, nights };
        if (!row.roomId) return next;
        const room = rooms.find((r) => String(r.id) === String(row.roomId));
        if (!room || !checkIn) return next;
        return {
          ...next,
          rate: getQuotedRoomNightlyRate(room, checkIn, nights),
        };
      }),
      additionalPaxLines: (q.additionalPaxLines || []).map((line) => ({
        ...line,
        nights: clampAdditionalPaxLineNights(
          line.nights !== '' && line.nights != null ? line.nights : nights,
          nights
        ),
      })),
    }));
  };

  const patch = (fields) => setQuote((q) => ({ ...q, ...fields }));

  const patchRoom = (index, fields) => {
    setQuote((q) => {
      const next = [...q.rooms];
      next[index] = { ...next[index], ...fields };
      return { ...q, rooms: next };
    });
  };

  const addRoom = () => {
    setQuote((q) => {
      const nights = getQuotationStayNights(q);
      return { ...q, rooms: [...q.rooms, { ...emptyQuotationRoom(), nights }] };
    });
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
    const catalog =
      islandHoppingRates.boat.find((b) => b.id === 'small') || islandHoppingRates.boat[0];
    setQuote((q) => ({
      ...q,
      boats: [
        ...(q.boats || []),
        { boatTierId: catalog?.id || 'small', rate: catalog?.rate ?? '' },
      ],
    }));
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
      const maxNights = getQuotationStayNights(q) || 1;
      const patch = { ...fields };
      if (Object.prototype.hasOwnProperty.call(patch, 'nights')) {
        patch.nights = clampAdditionalPaxLineNights(patch.nights, maxNights);
      }
      const next = [...(q.additionalPaxLines || [])];
      const prev = next[index] || emptyQuotationAdditionalPaxLine();
      next[index] = { ...prev, ...patch };
      return { ...q, additionalPaxLines: next };
    });
  };

  const addAdditionalPaxLine = () => {
    setQuote((q) => {
      const defaultNights = getQuotationStayNights(q) || 1;
      return {
        ...q,
        additionalPaxLines: [
          ...(q.additionalPaxLines || []),
          emptyQuotationAdditionalPaxLine(defaultNights),
        ],
      };
    });
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

  const patchCustomAddonLine = (index, fields) => {
    setQuote((q) => {
      const next = [...(q.customAddonLines || [])];
      next[index] = { ...next[index], ...fields };
      return { ...q, customAddonLines: next };
    });
  };

  const addCustomAddonLine = () => {
    setQuote((q) => ({
      ...q,
      customAddonLines: [...(q.customAddonLines || []), emptyQuotationCustomAddonLine()],
    }));
  };

  const removeCustomAddonLine = (index) => {
    setQuote((q) => ({
      ...q,
      customAddonLines: (q.customAddonLines || []).filter((_, i) => i !== index),
    }));
  };

  const applyRoomFromList = (index, roomId) => {
    if (!roomId) {
      patchRoom(index, { roomId: '' });
      return;
    }
    const room = rooms.find((r) => String(r.id) === String(roomId));
    if (!room) return;
    const nights = getQuotationStayNights(quote) || 1;
    const checkIn = getQuotationCheckIn(quote);
    patchRoom(index, {
      roomId: String(room.id),
      roomType: room.name?.toUpperCase() || '',
      rate: checkIn ? getQuotedRoomNightlyRate(room, checkIn, nights) : room.price_per_night ?? '',
      occupants: room.included_adults ?? room.min_guests ?? 2,
    });
  };

  const openPrint = () =>
    openQuotationPrint(quote, {
      extraPersonRates,
      islandHoppingRates,
      foodAddOnRates,
    });

  /** Open manual booking pre-filled from the quotation currently on screen. */
  const loadToBookingFromQuote = () => {
    const boatsWithRates = (quote.boats || []).map((boat) => {
      if (parseFloat(boat.rate) > 0) return boat;
      const catalog = islandHoppingRates.boat.find((b) => b.id === boat.boatTierId);
      return { ...boat, rate: catalog?.rate ?? boat.rate };
    });
    navigate('/admin/bookings', {
      state: {
        fromQuotation: {
          id: savedId,
          reference_code: referenceCode,
          quote_data: normalizeQuotation({ ...quote, boats: boatsWithRates }),
          guest_name: quote.guestName?.trim() || '',
        },
      },
    });
  };

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
        setQuoteBaselineKey((n) => n + 1);
      } else {
        const { data } = await api.post('/quotations/admin', payload);
        setSavedId(data.id);
        setReferenceCode(data.reference_code || '');
        toast.success('Quotation saved.');
        loadSavedList();
        setQuoteBaselineKey((n) => n + 1);
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
            <QuotationDocument
              quote={viewQuote.quote_data}
              extraPersonRates={extraPersonRates}
              islandHoppingRates={islandHoppingRates}
              foodAddOnRates={foodAddOnRates}
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() =>
                openQuotationPrint(viewQuote.quote_data, {
                  extraPersonRates,
                  islandHoppingRates,
                  foodAddOnRates,
                })
              }
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
        <>
          <AdminListFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search reference or guest…"
            showDates
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            dateFromLabel="Updated from"
            dateToLabel="Updated to"
          />
          {filteredQuotes.length === 0 ? (
            <p className="text-sm text-aegean-500">No quotations match this filter.</p>
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
              {pageItems.map((item) => (
                <tr key={item.id} className="border-b border-aegean-50">
                  <td className="py-2.5 pr-3 font-mono text-xs">{item.reference_code}</td>
                  <td className="py-2.5 pr-3">{item.guest_name || '—'}</td>
                  <td className="py-2.5 pr-3">₱{formatQuoteAmount(item.grand_total)}</td>
                  <td className="py-2.5 pr-3 text-aegean-500">
                    {item.updated_at ? formatDateTimePHT(item.updated_at) : '—'}
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
          {filteredQuotes.length > 0 && (
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
        </>
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
            onClick={loadToBookingFromQuote}
            className="px-4 py-2 rounded-lg border border-aegean-200 text-sm hover:bg-aegean-50"
            title="Create a manual booking from this quotation"
          >
            Load from quotation
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
            <h2 className="font-medium text-aegean-800">Document & guest</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Document heading">
                <input
                  className={inputClass}
                  value={quote.documentTitle ?? 'Quotation'}
                  onChange={(e) => patch({ documentTitle: e.target.value })}
                  placeholder="Quotation"
                />
              </Field>
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
                  onChange={(e) => patchDateLabel(e.target.value)}
                  placeholder="Aug 1 - Aug 3 or Aug 1-3, 2026"
                />
                {dateRangePreview ? (
                  <p className="text-xs text-aegean-500 mt-1">
                    Check-in {dateRangePreview.checkInLabel} → Check-out{' '}
                    {dateRangePreview.checkOutLabel} ({dateRangePreview.nights} night
                    {dateRangePreview.nights !== 1 ? 's' : ''})
                  </p>
                ) : quote.dateLabel?.trim() ? (
                  <p className="text-xs text-amber-600 mt-1">
                    Could not read dates — try &quot;Aug 1 - Aug 3&quot; or &quot;Aug 1-3, 2026&quot;
                  </p>
                ) : null}
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
            {dateRangePreview && (
              <p className="text-xs text-aegean-600 bg-aegean-50 rounded-lg px-3 py-2">
                Main stay: <strong>{dateRangePreview.nights} night{dateRangePreview.nights !== 1 ? 's' : ''}</strong>{' '}
                (check-out on {dateRangePreview.checkOutLabel})
              </p>
            )}
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
                      value={row.roomId || ''}
                      onChange={(e) => applyRoomFromList(index, e.target.value)}
                    >
                      <option value="">Select room…</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {formatRoomListOptionLabel(r, quote)}
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
                </div>
                <p className="text-xs text-aegean-500">
                  Line total: ₱
                  {formatQuoteAmount((parseFloat(row.rate) || 0) * stayNights)}
                  {' · '}
                  {stayNights} night{stayNights !== 1 ? 's' : ''}
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
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                    <Field label="Nights">
                      <input
                        type="number"
                        min={1}
                        max={stayNights || 1}
                        className={inputClass}
                        value={paxRow.nights ?? (stayNights || 1)}
                        onChange={(e) =>
                          patchAdditionalPaxLine(index, { nights: e.target.value })
                        }
                      />
                      <p className="text-xs text-aegean-500 mt-1">
                        Cannot exceed main stay ({stayNights || 1} night
                        {(stayNights || 1) !== 1 ? 's' : ''}).
                      </p>
                    </Field>
                  </div>
                  <p className="text-xs text-aegean-500">
                    {(() => {
                      const summary = describeAdditionalPaxLine(paxRow, paxContext);
                      return (
                        <>
                          Line total: ₱{formatQuoteAmount(summary.lineTotal)}
                          {summary.lineTotal > 0 || parseInt(paxRow.occupants, 10) > 0 ? (
                            <>
                              {' · '}
                              {summary.paxPart}
                              {summary.detailPart}
                            </>
                          ) : null}
                        </>
                      );
                    })()}
                  </p>
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
                          onChange={(e) => {
                            const boatTierId = e.target.value;
                            const catalog = islandHoppingRates.boat.find((b) => b.id === boatTierId);
                            patchBoat(index, {
                              boatTierId,
                              rate: catalog?.rate ?? '',
                            });
                          }}
                        >
                          {islandHoppingRates.boat.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.label} — ₱{b.rate.toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Boat rate (₱)">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputClass}
                          value={boatRow.rate}
                          onChange={(e) => patchBoat(index, { rate: e.target.value })}
                        />
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
                        {foodAddOnRates.bilaoPackages.map((p) => (
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
                        {foodAddOnRates.boodlePackages.map((p) => (
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

          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-aegean-800">
                <input
                  type="checkbox"
                  checked={Boolean(quote.customAddonsEnabled)}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    patch({
                      customAddonsEnabled: enabled,
                      customAddonLines:
                        enabled && !(quote.customAddonLines || []).length
                          ? [emptyQuotationCustomAddonLine()]
                          : quote.customAddonLines,
                    });
                  }}
                />
                Include other add-ons
              </label>
              {quote.customAddonsEnabled && (
                <button
                  type="button"
                  onClick={addCustomAddonLine}
                  className="inline-flex items-center gap-1 text-xs text-aegean-600 hover:text-aegean-800"
                >
                  <Plus size={14} /> Add line
                </button>
              )}
            </div>
            {quote.customAddonsEnabled && (
              <>
                <p className="text-xs text-aegean-500">
                  Room extension, food orders, transport, or any extra charge — label and amount are
                  fully editable.
                </p>
                <Field label="Section title on printout">
                  <input
                    className={inputClass}
                    value={quote.customAddonsSectionTitle ?? 'Other add-ons'}
                    onChange={(e) => patch({ customAddonsSectionTitle: e.target.value })}
                    placeholder="Other add-ons"
                  />
                </Field>
                {(quote.customAddonLines || []).length === 0 && (
                  <p className="text-xs text-aegean-500">No add-on lines yet.</p>
                )}
                {(quote.customAddonLines || []).map((line, index) => {
                  const lineTotal =
                    (parseFloat(line.rate) || 0) * (parseInt(line.qty, 10) || 1);
                  return (
                    <div
                      key={`custom-addon-${index}`}
                      className="rounded-lg border border-aegean-100 p-3 space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-medium text-aegean-600">Add-on {index + 1}</p>
                        <button
                          type="button"
                          onClick={() => removeCustomAddonLine(index)}
                          className="text-red-600 hover:text-red-700"
                          aria-label="Remove add-on"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="Item / label">
                          <input
                            className={inputClass}
                            list={`custom-addon-suggestions-${index}`}
                            value={line.label}
                            onChange={(e) =>
                              patchCustomAddonLine(index, { label: e.target.value })
                            }
                            placeholder="e.g. Room extension"
                          />
                          <datalist id={`custom-addon-suggestions-${index}`}>
                            {CUSTOM_ADDON_LABEL_SUGGESTIONS.map((s) => (
                              <option key={s} value={s} />
                            ))}
                          </datalist>
                        </Field>
                        <Field label="Details (optional)">
                          <input
                            className={inputClass}
                            value={line.detail}
                            onChange={(e) =>
                              patchCustomAddonLine(index, { detail: e.target.value })
                            }
                            placeholder="e.g. 1 extra night, lunch for 4 pax"
                          />
                        </Field>
                        <Field label="Rate (₱)">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className={inputClass}
                            value={line.rate}
                            onChange={(e) =>
                              patchCustomAddonLine(index, { rate: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Qty">
                          <input
                            type="number"
                            min={1}
                            className={inputClass}
                            value={line.qty}
                            onChange={(e) =>
                              patchCustomAddonLine(index, { qty: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                      <p className="text-xs text-aegean-500">
                        Line total: ₱{formatQuoteAmount(lineTotal)}
                      </p>
                    </div>
                  );
                })}
                {totals.customAddons.total > 0 && (
                  <p className="text-sm text-aegean-600">
                    Other add-ons total: ₱{formatQuoteAmount(totals.customAddons.total)}
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
          <QuotationDocument
            quote={quote}
            extraPersonRates={extraPersonRates}
            islandHoppingRates={islandHoppingRates}
            foodAddOnRates={foodAddOnRates}
          />
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

      {viewQuoteModal}
    </div>
  );
}
