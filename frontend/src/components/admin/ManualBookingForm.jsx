import { useEffect, useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import api, { getApiError } from '../../api/client';
import SubmitButton from '../ui/SubmitButton';
import BookingExtrasSection from '../booking/BookingExtrasSection';
import IslandHoppingSection from '../booking/IslandHoppingSection';
import PaymentAmountSelect from '../booking/PaymentAmountSelect';
import {
  getManualOnlyPaymentMethodName,
  isManualOnlyPaymentMethodId,
  MANUAL_ONLY_PAYMENT_METHODS,
} from '../../data/manualBookingPayment';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { emptyBookingExtras, validateBookingExtras } from '../../data/bookingAddOns';
import {
  calculateIslandHopping,
  emptyIslandHoppingForm,
  isSeniorPassenger,
  isPwdPassenger,
} from '../../data/islandHoppingRates';
import { validateManualBookingFields } from '../../utils/manualBookingValidation';
import AdminBookingDiscountFields from './AdminBookingDiscountFields';
import { minCheckOutDate, isPastStayDate } from '../../utils/stayDates';
import { digitsOnly } from '../../utils/inputSanitizers';

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
  room_id: '',
  guest_name: '',
  guest_email: '',
  guest_phone: '',
  valid_id: '',
  estimated_arrival: '',
  check_in: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  check_out: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
  adults: 2,
  children_under6: 0,
  children_7_12: 0,
  status: 'confirmed',
  special_requests: '',
  send_confirmation_email: false,
  payment_method_id: '',
  payment_option: 'full',
  custom_payment_amount: '',
  admin_discount_amount: '',
  admin_discount_note: '',
});

export default function ManualBookingForm({ onSuccess, onCancel }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rooms, setRooms] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [depositPercent, setDepositPercent] = useState(20);
  const [form, setForm] = useState(emptyForm);
  const [islandHoppingEnabled, setIslandHoppingEnabled] = useState(false);
  const [islandHopping, setIslandHopping] = useState(emptyIslandHoppingForm);
  const [bookingExtras, setBookingExtras] = useState(emptyBookingExtras);
  const [activeTab, setActiveTab] = useState('stay');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [availability, setAvailability] = useState(null);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);

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
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.room_id || !form.check_in || !form.check_out) {
      setAvailability(null);
      setAvailabilityChecking(false);
      return;
    }
    setAvailabilityChecking(true);
    api
      .get('/bookings/availability', {
        params: {
          room_id: form.room_id,
          check_in: form.check_in,
          check_out: form.check_out,
          adults: form.adults,
          children_under6: form.children_under6,
          children_7_12: form.children_7_12,
        },
      })
      .then((r) => setAvailability(r.data))
      .catch(() => setAvailability(null))
      .finally(() => setAvailabilityChecking(false));
  }, [
    form.room_id,
    form.check_in,
    form.check_out,
    form.adults,
    form.children_under6,
    form.children_7_12,
  ]);

  const selectedRoom = rooms.find((r) => String(r.id) === String(form.room_id));
  const roomType = selectedRoom?.room_type === 'suite' ? 'suite' : 'queen';
  const guestCount =
    (parseInt(form.adults, 10) || 0) +
    (parseInt(form.children_under6, 10) || 0) +
    (parseInt(form.children_7_12, 10) || 0);

  const roomSubtotal =
    availability?.subtotal != null &&
    (availability.available || isPastStayDate(form.check_in)) &&
    !availability.occupancy_error
      ? Number(availability.subtotal)
      : 0;

  const extrasQuote = selectedRoom ? validateBookingExtras(bookingExtras, roomType) : null;
  const islandQuote =
    islandHoppingEnabled && islandHopping.passengers?.length
      ? calculateIslandHopping(islandHopping.passengers)
      : null;
  const islandTotal =
    islandHoppingEnabled && islandQuote && !islandQuote.error && islandQuote.complete
      ? islandQuote.total
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

  const validationContext = useMemo(
    () => ({
      availability,
      availabilityChecking,
      selectedRoom,
      guestCount,
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
      availability,
      availabilityChecking,
      selectedRoom,
      guestCount,
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

  const buildPayload = () => ({
    room_id: parseInt(form.room_id, 10),
    guest_name: form.guest_name.trim(),
    guest_email: form.guest_email.trim(),
    guest_phone: form.guest_phone.trim(),
    valid_id: form.valid_id.trim(),
    estimated_arrival: form.estimated_arrival.trim() || null,
    adults: parseInt(form.adults, 10) || 1,
    children_under6: parseInt(form.children_under6, 10) || 0,
    children_7_12: parseInt(form.children_7_12, 10) || 0,
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
      ? {
          passengers: islandHopping.passengers.map((p) => ({
            full_name: p.full_name.trim(),
            age: parseInt(p.age, 10),
            gender: p.gender,
            is_first_timer: p.is_first_timer,
            is_senior: Boolean(p.is_senior),
            is_pwd: Boolean(p.is_pwd),
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
    bilao_package: bookingExtras.bilao_enabled ? bookingExtras.bilao_package : undefined,
    boodle_fight_enabled: bookingExtras.boodle_fight_enabled,
    boodle_fight_tier: bookingExtras.boodle_fight_enabled
      ? bookingExtras.boodle_fight_tier
      : undefined,
    admin_discount_amount: form.admin_discount_amount,
    admin_discount_note: form.admin_discount_note.trim() || undefined,
  });

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

    const ok = await confirm({
      title: 'Create manual booking?',
      message:
        form.status === 'confirmed'
          ? 'This will block the room on the website for these dates.'
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

  const priceSummary = useMemo(() => {
    if (!form.room_id || !availability) return null;
    const anteDate = isPastStayDate(form.check_in);
    // Occupancy always blocks; calendar conflicts only block future stays (not ante-date recording).
    if (availability.occupancy_error) {
      return { unavailable: true, message: availability.occupancy_error, anteDate };
    }
    if (!availability.available && !anteDate) {
      return { unavailable: true, message: null, anteDate };
    }
    return {
      unavailable: false,
      anteDate,
      nights: availability.nights,
      roomSubtotal,
      islandTotal,
      addOnsTotal,
      totalAmount,
      amountToPay,
    };
  }, [
    form.room_id,
    form.check_in,
    availability,
    roomSubtotal,
    islandTotal,
    addOnsTotal,
    totalAmount,
    amountToPay,
  ]);

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
            title="Room & dates"
            hint="Past check-in is allowed for late recording / Statement of Account. Confirmed future stays still block the public calendar."
          >
            <Field label="Room" required error={fieldErrors.room_id}>
              <select
                value={form.room_id}
                onChange={(e) => update({ room_id: e.target.value })}
                className={fieldInputClass(fieldErrors.room_id)}
              >
                <option value="">Select room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.min_guests ?? 1}–{r.max_guests ?? r.capacity} guests)
                  </option>
                ))}
              </select>
            </Field>
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
            {isPastStayDate(form.check_in) && (
              <p className="text-xs text-aegean-600 bg-aegean-50 border border-aegean-100 rounded-lg px-3 py-2">
                Ante-dated stay — for recording / Statement of Account when the booking was not
                entered on time.
              </p>
            )}
            <div>
              <p className="text-sm font-medium text-aegean-700 mb-3">Guests</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Adults" required error={fieldErrors.adults}>
                  <input
                    type="number"
                    min={1}
                    value={form.adults}
                    onChange={(e) => update({ adults: e.target.value })}
                    className={fieldInputClass(fieldErrors.adults)}
                  />
                </Field>
                <Field label="Under 6">
                  <input
                    type="number"
                    min={0}
                    value={form.children_under6}
                    onChange={(e) => update({ children_under6: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Age 7–12">
                  <input
                    type="number"
                    min={0}
                    value={form.children_7_12}
                    onChange={(e) => update({ children_7_12: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              {selectedRoom && guestCount > (selectedRoom.max_guests ?? selectedRoom.capacity ?? 99) && (
                <p className="text-xs text-amber-700 mt-2">
                  This room allows up to {selectedRoom.max_guests ?? selectedRoom.capacity} guests.
                </p>
              )}
            </div>
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
            {availabilityChecking && (
              <p className="text-sm text-aegean-500">Checking availability and price…</p>
            )}
            {priceSummary?.unavailable && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                Room not available for these dates
                {priceSummary.message ? ` — ${priceSummary.message}` : ''}.
              </p>
            )}
            {priceSummary &&
              !priceSummary.unavailable &&
              priceSummary.anteDate &&
              availability &&
              !availability.available && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Calendar shows a conflict, but ante-dated recording is allowed for Statement of
                  Account.
                </p>
              )}
            {priceSummary && !priceSummary.unavailable && priceSummary.totalAmount > 0 && (
              <p className="text-sm text-aegean-700 bg-aegean-50 rounded-lg px-3 py-2">
                Estimated total: <strong>₱{priceSummary.totalAmount.toLocaleString()}</strong>
                {priceSummary.nights ? ` · ${priceSummary.nights} night(s)` : ''}
                {priceSummary.islandTotal > 0 || priceSummary.addOnsTotal > 0 ? (
                  <>
                    {' '}
                    (room ₱{priceSummary.roomSubtotal.toLocaleString()}
                    {priceSummary.islandTotal > 0
                      ? ` + island hopping ₱${priceSummary.islandTotal.toLocaleString()}`
                      : ''}
                    {priceSummary.addOnsTotal > 0
                      ? ` + extras ₱${priceSummary.addOnsTotal.toLocaleString()}`
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
            />
            <div className="border-t border-aegean-100 pt-5">
              <IslandHoppingSection
                embedded
                enabled={islandHoppingEnabled}
                onEnabledChange={setIslandHoppingEnabled}
                data={islandHopping}
                onChange={setIslandHopping}
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
              disabled={priceSummary?.unavailable}
            >
              Create booking
            </SubmitButton>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-sm text-aegean-600 hover:underline">
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
