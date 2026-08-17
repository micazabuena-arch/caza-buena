import { useEffect, useMemo, useRef, useState } from 'react';
import { format, addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import api, { getApiError } from '../../api/client';
import SubmitButton from '../ui/SubmitButton';
import BookingExtrasSection from '../booking/BookingExtrasSection';
import FoodAddOnsOrderSummary from '../booking/FoodAddOnsOrderSummary';
import BookingRoomLinesSection from '../booking/BookingRoomLinesSection';
import IslandHoppingSection from '../booking/IslandHoppingSection';
import PaymentAmountSelect from '../booking/PaymentAmountSelect';
import {
  getManualOnlyPaymentMethodName,
  isManualOnlyPaymentMethodId,
  MANUAL_ONLY_PAYMENT_METHODS,
} from '../../data/manualBookingPayment';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { emptyBookingExtras, validateBookingExtras, bilaoLinesFromQty, boodleLinesFromQty } from '../../data/bookingAddOns';
import {
  calculateIslandHopping,
  emptyIslandHoppingForm,
  getAdminIslandHoppingTotal,
  ISLAND_HOPPING_RATES,
  isSeniorPassenger,
  isPwdPassenger,
} from '../../data/islandHoppingRates';
import { islandHoppingRatesFromSettings } from '../../utils/islandHoppingRatesConfig';
import { defaultFoodAddOnRates, foodAddOnRatesFromSettings } from '../../utils/foodAddOnRatesConfig';
import { validateManualBookingFields } from '../../utils/manualBookingValidation';
import AdminBookingDiscountFields from './AdminBookingDiscountFields';
import ManualBookingPriceSummary from './ManualBookingPriceSummary';
import { minCheckOutDate, isPastStayDate } from '../../utils/stayDates';
import { digitsOnly } from '../../utils/inputSanitizers';
import { mapQuotationToManualBooking } from '../../utils/quotationToManualBooking';
import {
  createRoomLine,
  roomLinesToPayload,
  totalGuestsFromLines,
  usedRoomIds,
} from '../../utils/bookingRoomLines';
import { useDirtySnapshot } from '../../hooks/useConfirmLeave';
import { useAdminModalClose, useRegisterModalDirty } from './AdminModal';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

const TABS = [
  { id: 'stay', label: '1. Stay' },
  { id: 'guest', label: '2. Guest' },
  { id: 'addons', label: '3. Add-ons' },
  { id: 'payment', label: '4. Payment' },
];

function Field({ label, required, children, className = '', error }) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="block text-sm font-medium text-aegean-700 mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}

function fieldInputClass(hasError) {
  return `${inputClass} ${hasError ? 'border-red-400 focus:ring-red-300' : ''}`.trim();
}

function Panel({ title, hint, children }) {
  return (
    <div className="space-y-4">
      {(title || hint) && (
        <div>
          {title && <p className="text-sm font-medium text-aegean-800">{title}</p>}
          {hint && <p className="text-xs text-aegean-500 mt-0.5">{hint}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

const emptyForm = () => ({
  guest_name: '',
  guest_email: '',
  guest_phone: '',
  valid_id: '',
  estimated_arrival: '',
  check_in: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  check_out: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
  status: 'confirmed',
  special_requests: '',
  send_confirmation_email: false,
  payment_method_id: '',
  payment_option: 'full',
  custom_payment_amount: '',
  admin_discount_amount: '',
  admin_discount_note: '',
});

export default function ManualBookingForm({ onSuccess, onCancel, quotationSeed = null }) {
  const toast = useToast();
  const confirm = useConfirm();
  const appliedQuotationKey = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [depositPercent, setDepositPercent] = useState(20);
  const [form, setForm] = useState(emptyForm);
  const [roomLines, setRoomLines] = useState(() => [createRoomLine()]);
  const [lineQuotes, setLineQuotes] = useState({});
  const [lineQuotesLoading, setLineQuotesLoading] = useState(false);
  const [quotationPricing, setQuotationPricing] = useState(null);
  const [islandHoppingEnabled, setIslandHoppingEnabled] = useState(false);
  const [islandHopping, setIslandHopping] = useState(emptyIslandHoppingForm);
  const [islandHoppingRates, setIslandHoppingRates] = useState(ISLAND_HOPPING_RATES);
  const [foodAddOnRates, setFoodAddOnRates] = useState(defaultFoodAddOnRates);
  const [bookingExtras, setBookingExtras] = useState(emptyBookingExtras);
  const [activeTab, setActiveTab] = useState('stay');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const requestClose = useAdminModalClose();
  const isDirty = useDirtySnapshot(
    { form, roomLines, bookingExtras, islandHoppingEnabled, islandHopping },
    true
  );
  useRegisterModalDirty(isDirty);

  useEffect(() => {
    Promise.all([
      api.get('/rooms/admin/all'),
      api.get('/payment-methods'),
      api.get('/settings/public'),
    ])
      .then(([roomsRes, payRes, settingsRes]) => {
        setRooms(roomsRes.data || []);
        setPaymentMethods(payRes.data || []);
        if (settingsRes.data?.booking_deposit_percent) {
          setDepositPercent(settingsRes.data.booking_deposit_percent);
        }
        if (settingsRes.data?.island_hopping_rates) {
          setIslandHoppingRates(islandHoppingRatesFromSettings(settingsRes.data));
        }
        if (settingsRes.data?.food_add_on_rates) {
          setFoodAddOnRates(foodAddOnRatesFromSettings(settingsRes.data));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!quotationSeed || rooms.length === 0) return;

    const seedKey =
      quotationSeed.id ||
      quotationSeed.reference_code ||
      JSON.stringify(quotationSeed.quote_data || {});
    if (appliedQuotationKey.current === seedKey) return;
    appliedQuotationKey.current = seedKey;

    const mapped = mapQuotationToManualBooking(quotationSeed, {
      rooms,
      depositPercent,
      islandHoppingRates,
      foodAddOnRates,
    });
    setForm({
      ...emptyForm(),
      ...mapped.form,
    });
    setRoomLines(mapped.roomLines);
    setLineQuotes({});
    setQuotationPricing(
      mapped.quotationPricing
        ? { ...mapped.quotationPricing, quotationId: mapped.quotationId }
        : null
    );
    setBookingExtras(mapped.bookingExtras);
    setIslandHoppingEnabled(mapped.islandHoppingEnabled);
    setIslandHopping(mapped.islandHopping);
    setFieldErrors({});
    setError('');
    setActiveTab('stay');

    const label = quotationSeed.reference_code || 'quotation';
    const discountPart = mapped.form.admin_discount_amount
      ? ` · Discount ₱${Number(mapped.form.admin_discount_amount).toLocaleString()}`
      : '';
    toast.success(
      `Loaded from ${label}${discountPart}. Add guest contact details, then create the booking.`
    );
  }, [quotationSeed, rooms, depositPercent, islandHoppingRates, foodAddOnRates, toast]);

  // Price each selected room for the shared check-in / check-out dates.
  useEffect(() => {
    if (!form.check_in || !form.check_out) {
      setLineQuotes({});
      setLineQuotesLoading(false);
      return undefined;
    }

    const linesWithRoom = roomLines.filter((line) => line.room_id);
    if (linesWithRoom.length === 0) {
      setLineQuotes({});
      setLineQuotesLoading(false);
      return undefined;
    }

    setLineQuotesLoading(true);
    let cancelled = false;

    Promise.all(
      linesWithRoom.map((line) =>
        api
          .get('/bookings/availability', {
            params: {
              room_id: line.room_id,
              check_in: form.check_in,
              check_out: form.check_out,
              adults: line.adults,
              children_under6: line.children_under6,
              children_7_12: line.children_7_12,
            },
          })
          .then((r) => ({ id: line.id, data: r.data }))
          .catch(() => ({ id: line.id, data: null }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        const next = {};
        results.forEach(({ id, data }) => {
          next[id] = data;
        });
        setLineQuotes(next);
      })
      .finally(() => {
        if (!cancelled) setLineQuotesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roomLines, form.check_in, form.check_out]);

  const quotedNights =
    form.check_in && form.check_out
      ? Math.max(
          0,
          differenceInCalendarDays(parseISO(form.check_out), parseISO(form.check_in))
        )
      : 0;

  const displayLineQuotes = useMemo(() => {
    if (!quotationPricing?.lineSubtotalsByLineId) return lineQuotes;

    const next = { ...lineQuotes };
    roomLines.forEach((line) => {
      const quotedSubtotal = quotationPricing.lineSubtotalsByLineId[line.id];
      if (quotedSubtotal == null) return;
      next[line.id] = {
        ...(next[line.id] || {}),
        available: next[line.id]?.available ?? true,
        nights: next[line.id]?.nights || quotedNights,
        subtotal: quotedSubtotal,
        quoted_from_quotation: true,
      };
    });
    return next;
  }, [lineQuotes, quotationPricing, roomLines, quotedNights]);

  const anteDate = isPastStayDate(form.check_in);
  const guestCount = totalGuestsFromLines(roomLines);
  const primaryLine = roomLines[0];
  const selectedRoom = primaryLine?.room_id
    ? rooms.find((r) => String(r.id) === String(primaryLine.room_id))
    : null;
  // Suite extras (e.g. bilao) unlock if ANY selected room is a suite.
  const roomType = roomLines.some(
    (line) => rooms.find((r) => String(r.id) === String(line.room_id))?.room_type === 'suite'
  )
    ? 'suite'
    : 'queen';

  const roomSubtotal = quotationPricing?.accommodationSubtotal
    ? Number(quotationPricing.accommodationSubtotal)
    : roomLines.reduce((sum, line) => {
        const quote = lineQuotes[line.id];
        if (!quote || quote.occupancy_error) return sum;
        if (!(quote.available || anteDate)) return sum;
        if (quote.subtotal == null) return sum;
        return sum + Number(quote.subtotal);
      }, 0);

  const nights =
    Object.values(displayLineQuotes).find((q) => q?.nights)?.nights || quotedNights || 0;

  const extrasQuote = selectedRoom || roomLines.some((l) => l.room_id)
    ? validateBookingExtras(bookingExtras, roomType, foodAddOnRates)
    : null;
  const islandQuote =
    islandHoppingEnabled && !islandHopping.soa_summary && islandHopping.passengers?.length
      ? calculateIslandHopping(islandHopping.passengers, islandHoppingRates)
      : null;
  const islandTotal = islandHoppingEnabled
    ? getAdminIslandHoppingTotal(islandHopping, islandHoppingRates)
    : 0;
  const addOnsTotal = extrasQuote?.valid ? extrasQuote.add_ons_total : 0;
  const manualDiscountRaw = parseFloat(form.admin_discount_amount);
  const manualDiscount =
    Number.isFinite(manualDiscountRaw) && manualDiscountRaw > 0
      ? Math.min(manualDiscountRaw, roomSubtotal)
      : 0;
  const totalAmount = Math.max(0, roomSubtotal - manualDiscount) + islandTotal + addOnsTotal;

  const customPay = parseFloat(form.custom_payment_amount);
  const amountToPay =
    form.payment_option === 'full'
      ? totalAmount
      : form.payment_option === 'deposit'
        ? Math.round(((totalAmount * depositPercent) / 100) * 100) / 100
        : Number.isFinite(customPay)
          ? customPay
          : 0;

  const anyUnavailable =
    !anteDate &&
    roomLines.some((line) => {
      if (!line.room_id) return false;
      const quote = lineQuotes[line.id];
      return quote && !quote.available && !quote.occupancy_error;
    });

  const update = (patch) => {
    const cleanPatch = { ...patch };
    if (Object.prototype.hasOwnProperty.call(cleanPatch, 'guest_phone')) {
      cleanPatch.guest_phone = digitsOnly(cleanPatch.guest_phone);
    }
    setForm((f) => ({ ...f, ...cleanPatch }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      Object.keys(cleanPatch).forEach((key) => delete next[key]);
      return next;
    });
    setError('');
  };

  const handleLineChange = (lineId, patch) => {
    setRoomLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.room_id;
      delete next.adults;
      return next;
    });
    setError('');
  };

  const handleAddLine = () => {
    setRoomLines((prev) => [...prev, createRoomLine()]);
    setError('');
  };

  const handleRemoveLine = (lineId) => {
    setRoomLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.id !== lineId)));
    setError('');
  };

  const validationContext = useMemo(
    () => ({
      roomLines,
      lineQuotes: displayLineQuotes,
      lineQuotesLoading,
      rooms,
      paymentMethods,
      manualOnlyPaymentMethods: MANUAL_ONLY_PAYMENT_METHODS,
      extrasQuote,
      islandHoppingEnabled,
      islandQuote,
      islandHopping,
      totalAmount,
      roomSubtotal,
      customPay,
    }),
    [
      roomLines,
      displayLineQuotes,
      lineQuotesLoading,
      rooms,
      paymentMethods,
      extrasQuote,
      islandHoppingEnabled,
      islandQuote,
      islandHopping,
      totalAmount,
      roomSubtotal,
      customPay,
    ]
  );

  const runValidation = (tab) =>
    validateManualBookingFields(form, { ...validationContext, tab });

  const applyValidationResult = (result) => {
    setFieldErrors(result.fieldErrors);
    setError(result.bannerError || '');
    if (result.firstTabWithError) setActiveTab(result.firstTabWithError);
    return (
      Object.keys(result.fieldErrors).length === 0 &&
      !result.bannerError
    );
  };

  const validateTab = (tab) => applyValidationResult(runValidation(tab));

  const validateAll = () => applyValidationResult(runValidation('all'));

  const buildPayload = () => {
    const linesPayload = roomLinesToPayload(roomLines);
    const primary = linesPayload[0] || {};
    return {
      room_id: primary.room_id,
      room_lines: linesPayload,
      guest_name: form.guest_name.trim(),
      guest_email: form.guest_email.trim(),
      guest_phone: form.guest_phone.trim(),
      valid_id: form.valid_id.trim(),
      estimated_arrival: form.estimated_arrival.trim() || null,
      adults: primary.adults || 1,
      children_under6: primary.children_under6 || 0,
      children_7_12: primary.children_7_12 || 0,
      check_in: form.check_in,
      check_out: form.check_out,
      status: form.status,
      special_requests: form.special_requests.trim() || undefined,
      send_confirmation_email: form.send_confirmation_email,
      payment_method_id: isManualOnlyPaymentMethodId(form.payment_method_id)
        ? null
        : form.payment_method_id
          ? parseInt(form.payment_method_id, 10)
          : null,
      manual_payment_method: isManualOnlyPaymentMethodId(form.payment_method_id)
        ? getManualOnlyPaymentMethodName(form.payment_method_id)
        : undefined,
      payment_option: form.payment_option,
      custom_payment_amount: form.payment_option === 'custom' ? customPay : undefined,
      island_hopping: islandHoppingEnabled,
      island_hopping_data: islandHoppingEnabled
        ? islandHopping.soa_summary
          ? {
              soa_summary: true,
              summary_pax: parseInt(islandHopping.summary_pax, 10) || 0,
              summary_amount: parseFloat(islandHopping.summary_amount) || 0,
            }
          : {
            passengers: islandHopping.passengers.map((p) => ({
              full_name: p.full_name.trim(),
              age: parseInt(p.age, 10),
              gender: p.gender,
              is_first_timer: p.is_first_timer,
              is_senior: Boolean(p.is_senior),
              // Preserve "unanswered" (null) so the backend's completeness check agrees
              // with the form — coercing to false would make the backend price a tour
              // the form shows as excluded.
              is_pwd: p.is_pwd === true || p.is_pwd === false ? p.is_pwd : null,
            })),
            passenger_address: islandHopping.passenger_address,
            payor_name: islandHopping.payor_name,
            payor_address: islandHopping.payor_address,
            payor_phone: islandHopping.payor_phone,
            emergency_contact_name: islandHopping.emergency_contact_name,
            emergency_contact_phone: islandHopping.emergency_contact_phone,
          }
        : undefined,
      bringing_car: bookingExtras.bringing_car,
      car_count: bookingExtras.bringing_car ? parseInt(bookingExtras.car_count, 10) || 1 : 0,
      pet_count: parseInt(bookingExtras.pet_count, 10) || 0,
      bilao_enabled: bookingExtras.bilao_enabled,
      bilao_lines: bookingExtras.bilao_enabled
        ? bilaoLinesFromQty(bookingExtras.bilao_qty)
        : undefined,
      boodle_fight_enabled: bookingExtras.boodle_fight_enabled,
      boodle_lines: bookingExtras.boodle_fight_enabled
        ? boodleLinesFromQty(bookingExtras.boodle_qty)
        : undefined,
      admin_discount_amount:
        form.admin_discount_amount === '' || form.admin_discount_amount == null
          ? undefined
          : form.admin_discount_amount,
      admin_discount_note: form.admin_discount_note.trim() || undefined,
      quotation_id: quotationPricing?.quotationId || undefined,
      quoted_stay_subtotal: quotationPricing?.accommodationSubtotal || undefined,
      quoted_room_line_subtotals: quotationPricing?.lineSubtotals?.length
        ? quotationPricing.lineSubtotals
        : undefined,
    };
  };

  const uploadIslandHoppingIds = async (reference) => {
    if (!islandHoppingEnabled) return false;
    const seniorUploads = islandHopping.passengers
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => isSeniorPassenger(p) && p.senior_id_file);
    const pwdUploads = islandHopping.passengers
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => isPwdPassenger(p) && p.pwd_id_file);

    let uploadFailed = false;
    for (const { p, index } of seniorUploads) {
      try {
        const formData = new FormData();
        formData.append('id', p.senior_id_file);
        formData.append('passenger_index', String(index));
        await api.post(`/bookings/${reference}/senior-id`, formData);
      } catch {
        uploadFailed = true;
      }
    }
    for (const { p, index } of pwdUploads) {
      try {
        const formData = new FormData();
        formData.append('id', p.pwd_id_file);
        formData.append('passenger_index', String(index));
        await api.post(`/bookings/${reference}/pwd-id`, formData);
      } catch {
        uploadFailed = true;
      }
    }
    return uploadFailed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    const roomLabel = roomLines.length > 1 ? 'rooms' : 'room';
    const ok = await confirm({
      title: 'Create manual booking?',
      message:
        form.status === 'confirmed'
          ? `This will block the ${roomLabel} on the website for these dates.`
          : 'Create this booking record?',
      confirmLabel: 'Yes, create',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/bookings/admin', buildPayload());
      const reference = data?.booking?.reference_code;
      if (reference) {
        const uploadFailed = await uploadIslandHoppingIds(reference);
        if (uploadFailed) {
          toast.warning('Booking created. Some ID uploads failed — upload them from the booking detail.');
        }
      }

      if (data.email_sent) {
        toast.success(`Booking ${data.booking.reference_code} created. Confirmation email sent.`);
      } else if (form.send_confirmation_email && form.status === 'confirmed') {
        toast.warning(data.email_hint || 'Booking created, but confirmation email was not sent.');
      } else {
        toast.success(`Booking ${data.booking.reference_code} created.`);
      }
      onSuccess?.(data.booking);
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (!validateTab(activeTab)) return;
    const idx = TABS.findIndex((t) => t.id === activeTab);
    if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      <div className="flex gap-1 p-1 bg-aegean-50 rounded-xl mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-xs sm:text-sm py-2.5 px-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-aegean-800 font-medium shadow-sm'
                : 'text-aegean-600 hover:text-aegean-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="min-h-[200px]">
        {activeTab === 'stay' && (
          <Panel
            title="Rooms & dates"
            hint="Past check-in is allowed for late recording / Statement of Account. Confirmed future stays still block the public calendar. Guests can book more than one room under the same reservation."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Check-in" required error={fieldErrors.check_in}>
                <input
                  type="date"
                  value={form.check_in}
                  onChange={(e) => {
                    const value = e.target.value;
                    const patch = { check_in: value };
                    const earliest = minCheckOutDate(value);
                    if (earliest && form.check_out && form.check_out <= value) {
                      patch.check_out = earliest;
                    }
                    update(patch);
                  }}
                  className={fieldInputClass(fieldErrors.check_in)}
                />
              </Field>
              <Field label="Check-out" required error={fieldErrors.check_out}>
                <input
                  type="date"
                  min={minCheckOutDate(form.check_in)}
                  value={form.check_out}
                  onChange={(e) => update({ check_out: e.target.value })}
                  className={fieldInputClass(fieldErrors.check_out)}
                />
              </Field>
            </div>
            {anteDate && (
              <p className="text-xs text-aegean-600 bg-aegean-50 border border-aegean-100 rounded-lg px-3 py-2">
                Ante-dated stay — for recording / Statement of Account when the booking was not
                entered on time.
              </p>
            )}

            {quotationPricing && (
              <p className="text-xs text-aegean-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
                Using accommodation rates from the quotation (not live weekday/weekend pricing).
              </p>
            )}

            <BookingRoomLinesSection
              lines={roomLines}
              rooms={rooms}
              lineQuotes={displayLineQuotes}
              quotesLoading={lineQuotesLoading}
              onLineChange={handleLineChange}
              onAddLine={handleAddLine}
              onRemoveLine={handleRemoveLine}
              usedRoomIds={usedRoomIds(roomLines)}
              allowUnavailable={anteDate}
              showAssignedRoomNumber
            />
            {fieldErrors.room_id && (
              <p className="text-xs text-red-600" role="alert">
                {fieldErrors.room_id}
              </p>
            )}
            {fieldErrors.adults && (
              <p className="text-xs text-red-600" role="alert">
                {fieldErrors.adults}
              </p>
            )}

            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => update({ status: e.target.value })}
                className={inputClass}
              >
                <option value="confirmed">Confirmed (blocks site)</option>
                <option value="awaiting_payment">Awaiting payment</option>
                <option value="payment_submitted">Payment submitted</option>
                <option value="pending">Pending</option>
              </select>
            </Field>

            {lineQuotesLoading && (
              <p className="text-sm text-aegean-500">Checking availability and price…</p>
            )}
            {anyUnavailable && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                One or more rooms are not available for these dates.
              </p>
            )}
            {!anyUnavailable && roomSubtotal > 0 && (
              <p className="text-sm text-aegean-700 bg-aegean-50 rounded-lg px-3 py-2">
                Estimated total: <strong>₱{totalAmount.toLocaleString()}</strong>
                {nights ? ` · ${nights} night(s)` : ''}
                {roomLines.length > 1 ? ` · ${roomLines.length} rooms` : ''}
                {guestCount > 0 ? ` · ${guestCount} guest(s)` : ''}
                {islandTotal > 0 || addOnsTotal > 0 ? (
                  <>
                    {' '}
                    (rooms ₱{roomSubtotal.toLocaleString()}
                    {islandTotal > 0
                      ? ` + island hopping ₱${islandTotal.toLocaleString()}`
                      : ''}
                    {addOnsTotal > 0
                      ? ` + extras ₱${addOnsTotal.toLocaleString()}`
                      : ''}
                    )
                  </>
                ) : null}
              </p>
            )}
          </Panel>
        )}

        {activeTab === 'guest' && (
          <Panel title="Lead guest" hint="Same contact fields as the public booking form.">
            <Field label="Full name" required error={fieldErrors.guest_name}>
              <input
                value={form.guest_name}
                onChange={(e) => update({ guest_name: e.target.value })}
                className={fieldInputClass(fieldErrors.guest_name)}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Phone" required error={fieldErrors.guest_phone}>
                <input
                  type="tel"
                  value={form.guest_phone}
                  onChange={(e) => update({ guest_phone: e.target.value })}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={fieldInputClass(fieldErrors.guest_phone)}
                  placeholder="e.g. 09171234567"
                />
              </Field>
              <Field label="Email" required error={fieldErrors.guest_email}>
                <input
                  type="email"
                  value={form.guest_email}
                  onChange={(e) => update({ guest_email: e.target.value })}
                  className={fieldInputClass(fieldErrors.guest_email)}
                  placeholder="name@email.com"
                />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Valid ID" required error={fieldErrors.valid_id}>
                <input
                  value={form.valid_id}
                  onChange={(e) => update({ valid_id: e.target.value })}
                  className={fieldInputClass(fieldErrors.valid_id)}
                  placeholder="e.g. Driver's License — N01-12-345678"
                />
              </Field>
              <Field label="Estimated arrival">
                <input
                  value={form.estimated_arrival}
                  onChange={(e) => update({ estimated_arrival: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. 2:00 PM"
                />
              </Field>
            </div>
          </Panel>
        )}

        {activeTab === 'addons' && (
          <Panel title="Optional extras" hint="Car, pets, food packages, and island hopping.">
            <BookingExtrasSection
              data={bookingExtras}
              onChange={setBookingExtras}
              roomType={roomType}
              foodRates={foodAddOnRates}
            />
            <div className="border-t border-aegean-100 pt-4 mt-4">
              <FoodAddOnsOrderSummary
                extrasQuote={extrasQuote}
                bookingExtras={bookingExtras}
                showHints
              />
            </div>
            <div className="border-t border-aegean-100 pt-5">
              <IslandHoppingSection
                embedded
                optionalFields
                enabled={islandHoppingEnabled}
                onEnabledChange={setIslandHoppingEnabled}
                data={islandHopping}
                onChange={setIslandHopping}
                rates={islandHoppingRates}
              />
            </div>
          </Panel>
        )}

        {activeTab === 'payment' && (
          <Panel title="Payment & notes">
            {(paymentMethods.length > 0 || MANUAL_ONLY_PAYMENT_METHODS.length > 0) && (
              <Field label="Payment method" required error={fieldErrors.payment_method_id}>
                <select
                  value={form.payment_method_id}
                  onChange={(e) => update({ payment_method_id: e.target.value })}
                  className={fieldInputClass(fieldErrors.payment_method_id)}
                >
                  <option value="">Select payment method</option>
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  {MANUAL_ONLY_PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <AdminBookingDiscountFields
              amount={form.admin_discount_amount}
              note={form.admin_discount_note}
              onAmountChange={(val) => update({ admin_discount_amount: val })}
              onNoteChange={(val) => update({ admin_discount_note: val })}
              maxAmount={roomSubtotal}
              error={fieldErrors.admin_discount_amount}
            />
            <ManualBookingPriceSummary
              roomLines={roomLines}
              lineQuotes={displayLineQuotes}
              rooms={rooms}
              nights={nights}
              roomSubtotal={roomSubtotal}
              manualDiscount={manualDiscount}
              discountNote={form.admin_discount_note}
              islandTotal={islandTotal}
              islandHoppingEnabled={islandHoppingEnabled}
              extrasQuote={extrasQuote}
              bookingExtras={bookingExtras}
              totalAmount={totalAmount}
            />
            <PaymentAmountSelect
              totalAmount={totalAmount > 0 ? totalAmount : 0}
              depositPercent={depositPercent}
              paymentOption={form.payment_option}
              customAmount={form.custom_payment_amount}
              onOptionChange={(id) => update({ payment_option: id })}
              onCustomAmountChange={(val) => update({ custom_payment_amount: val })}
            />
            {fieldErrors.custom_payment_amount && (
              <p className="text-xs text-red-600" role="alert">
                {fieldErrors.custom_payment_amount}
              </p>
            )}
            <p className="text-xs text-aegean-500 -mt-2">
              Amount due now: ₱{amountToPay.toLocaleString()}
              {totalAmount > 0 ? ` · Total booking: ₱${totalAmount.toLocaleString()}` : ''}
            </p>
            <Field label="Special requests">
              <textarea
                rows={3}
                value={form.special_requests}
                onChange={(e) => update({ special_requests: e.target.value })}
                className={inputClass}
                placeholder="Guest requests"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-aegean-700">
              <input
                type="checkbox"
                checked={form.send_confirmation_email}
                disabled={form.status !== 'confirmed'}
                onChange={(e) => update({ send_confirmation_email: e.target.checked })}
                className="rounded"
              />
              Send confirmation email to guest (only when status is Confirmed)
            </label>
          </Panel>
        )}
      </div>

      <div className="border-t border-aegean-100 pt-4 pb-2 mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-aegean-500">
          Tab {TABS.findIndex((t) => t.id === activeTab) + 1} of {TABS.length}
        </p>
        <div className="flex flex-wrap gap-3">
          {activeTab !== 'stay' && (
            <button
              type="button"
              onClick={() => {
                const idx = TABS.findIndex((t) => t.id === activeTab);
                if (idx > 0) setActiveTab(TABS[idx - 1].id);
              }}
              className="btn-outline text-sm"
            >
              Back
            </button>
          )}
          {activeTab !== 'payment' ? (
            <button type="button" onClick={goNext} className="btn-primary text-sm">
              Next
            </button>
          ) : (
            <SubmitButton
              loading={saving}
              loadingLabel="Creating..."
              className="text-sm"
              disabled={anyUnavailable}
            >
              Create booking
            </SubmitButton>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={() => (requestClose || onCancel)?.()}
              className="text-sm text-aegean-600 hover:underline"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
