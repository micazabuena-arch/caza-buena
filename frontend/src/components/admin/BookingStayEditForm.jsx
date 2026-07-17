import { useEffect, useMemo, useState } from 'react';
import api, { getApiError } from '../../api/client';
import SubmitButton from '../ui/SubmitButton';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import BookingExtrasSection from '../booking/BookingExtrasSection';
import IslandHoppingSection from '../booking/IslandHoppingSection';
import PaymentAmountSelect from '../booking/PaymentAmountSelect';
import { validateBookingExtras } from '../../data/bookingAddOns';
import { MANUAL_ONLY_PAYMENT_METHODS } from '../../data/manualBookingPayment';
import { calculateIslandHopping } from '../../data/islandHoppingRates';
import { bookingToEditState, editStateToPayload } from '../../utils/bookingEditForm';
import AdminBookingDiscountFields from './AdminBookingDiscountFields';
import RebookPricePreview, { rebookConfirmMessage } from './RebookPricePreview';
import { minCheckOutDate, isPastStayDate } from '../../utils/stayDates';
import { digitsOnly } from '../../utils/inputSanitizers';
import { stayAddonsTotal } from '../../utils/stayAddons';
import BookingCustomAddons from './BookingCustomAddons';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

const TABS = [
  { id: 'stay', label: '1. Stay' },
  { id: 'guest', label: '2. Guest' },
  { id: 'addons', label: '3. Add-ons' },
  { id: 'custom-addons', label: '4. Extra charges' },
  { id: 'payment', label: '5. Payment' },
];

function Field({ label, required, children, className = '' }) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="block text-sm font-medium text-aegean-700 mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
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

export default function BookingStayEditForm({ booking, onSaved, onCancel }) {
  const [rooms, setRooms] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [depositPercent, setDepositPercent] = useState(20);
  const [form, setForm] = useState(() => bookingToEditState(booking));
  const [activeTab, setActiveTab] = useState('stay');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rebookQuote, setRebookQuote] = useState(null);
  const [rebookQuoteLoading, setRebookQuoteLoading] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    setForm(bookingToEditState(booking));
    setError('');
    setActiveTab('stay');
  }, [booking?.id]);

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

  const stayDatesChanged =
    form.check_in !== (booking.check_in?.slice(0, 10) || '') ||
    form.check_out !== (booking.check_out?.slice(0, 10) || '') ||
    String(form.room_id) !== String(booking.room_id);

  useEffect(() => {
    if (!form.room_id || !form.check_in || !form.check_out || !stayDatesChanged) {
      setRebookQuote(null);
      return;
    }

    setRebookQuoteLoading(true);
    const timer = setTimeout(() => {
      api
        .get(`/bookings/admin/${booking.id}/rebook-quote`, {
          params: {
            check_in: form.check_in,
            check_out: form.check_out,
            room_id: form.room_id,
          },
        })
        .then((r) => setRebookQuote(r.data))
        .catch(() => setRebookQuote(null))
        .finally(() => setRebookQuoteLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [
    booking.id,
    form.room_id,
    form.check_in,
    form.check_out,
    stayDatesChanged,
  ]);

  const selectedRoom = rooms.find((r) => String(r.id) === String(form.room_id));
  const roomType = selectedRoom?.room_type === 'suite' ? 'suite' : 'queen';

  const extrasQuote = validateBookingExtras(form.bookingExtras, roomType);
  const islandQuote =
    form.islandHoppingEnabled && form.islandHopping.passengers?.length
      ? calculateIslandHopping(form.islandHopping.passengers)
      : null;
  const islandTotal =
    form.islandHoppingEnabled && islandQuote && !islandQuote.error && islandQuote.complete
      ? islandQuote.total
      : 0;
  const addOnsTotal = extrasQuote?.valid ? extrasQuote.add_ons_total : 0;
  const estimatedAddOns = islandTotal + addOnsTotal;

  // Room-only gross stay total (excludes every add-on), used for the discount cap and
  // as the base of the payment preview. The rebook quote already returns a room-only
  // subtotal; the non-rebook branch strips all add-ons (island/bilao/boodle, custom
  // charges, and during-stay stay_addons) so both paths mean the same thing.
  const grossRoomSubtotal = useMemo(() => {
    if (rebookQuote?.new_stay_subtotal != null) {
      return Number(rebookQuote.new_stay_subtotal);
    }
    const addonsOnBooking =
      Number(booking?.island_hopping_amount || 0) +
      Number(booking?.bilao_amount || 0) +
      Number(booking?.boodle_fight_amount || 0) +
      (Array.isArray(booking?.addons)
        ? booking.addons.reduce((s, a) => s + (Number(a.amount) || 0), 0)
        : 0) +
      stayAddonsTotal(booking?.stay_addons);
    const roomNet = Number(booking?.total_amount || 0) - addonsOnBooking;
    return roomNet + Number(booking?.discount_amount || 0);
  }, [booking, rebookQuote]);

  const manualDiscountRaw = parseFloat(form.admin_discount_amount);
  const manualDiscount =
    booking?.discount_code || !Number.isFinite(manualDiscountRaw) || manualDiscountRaw <= 0
      ? 0
      : Math.min(manualDiscountRaw, grossRoomSubtotal);

  const update = (patch) => {
    const cleanPatch = { ...patch };
    if (Object.prototype.hasOwnProperty.call(cleanPatch, 'guest_phone')) {
      cleanPatch.guest_phone = digitsOnly(cleanPatch.guest_phone);
    }
    setForm((f) => ({ ...f, ...cleanPatch }));
  };

  const validate = () => {
    if (!form.room_id) return 'Select a room (tab 1).';
    if (!form.check_in || !form.check_out) return 'Check-in and check-out are required (tab 1).';
    if (!form.guest_name.trim()) return 'Guest name is required (tab 2).';
    if (!form.guest_email.trim()) return 'Email is required (tab 2).';
    if (!form.guest_phone.trim()) return 'Phone is required (tab 2).';
    if (!extrasQuote?.valid) return extrasQuote.message;
    if (form.islandHoppingEnabled) {
      // Island hopping details are optional for admin bookings (guests may not give
      // passenger names up front, and partial bookings created via manual booking must
      // remain editable). Only block on hard errors (e.g. exceeding max passengers).
      if (islandQuote?.error) return islandQuote.error;
    }
    if (form.payment_option === 'custom') {
      const custom = parseFloat(form.custom_payment_amount);
      if (!Number.isFinite(custom) || custom <= 0) return 'Enter a valid custom amount (tab 4).';
    }
    if (!booking.discount_code && form.admin_discount_amount !== '' && form.admin_discount_amount != null) {
      const discount = parseFloat(form.admin_discount_amount);
      if (!Number.isFinite(discount) || discount < 0) {
        return 'Enter a valid discount amount (tab 4).';
      }
      if (discount > 0 && grossRoomSubtotal > 0 && discount > grossRoomSubtotal) {
        return `Discount cannot exceed room stay total (₱${Math.round(grossRoomSubtotal).toLocaleString()}) (tab 4).`;
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    const confirmMessage =
      stayDatesChanged && rebookQuote && !rebookQuote.error
        ? rebookConfirmMessage(
            rebookQuote,
            booking.reference_code,
            form.check_in,
            form.check_out
          )
        : 'Pricing will be recalculated based on your updates.';
    const ok = await confirm({
      title: 'Save booking changes?',
      message: confirmMessage,
      confirmLabel: 'Yes, save',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch(`/bookings/admin/${booking.id}`, editStateToPayload(form));
      toast.success('Booking updated.');
      onSaved?.(data.booking);
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const paymentPreviewTotal = useMemo(() => {
    const roomPart = Math.max(0, grossRoomSubtotal - manualDiscount);
    // Custom during-stay charges (booking.addons) and stay_addons are saved separately
    // but are part of the stored total, so include them in the preview so it matches.
    const customAddonsOnBooking = Array.isArray(booking?.addons)
      ? booking.addons.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
      : 0;
    const stayAddonsOnBooking = stayAddonsTotal(booking?.stay_addons);
    return roomPart + estimatedAddOns + customAddonsOnBooking + stayAddonsOnBooking;
  }, [estimatedAddOns, grossRoomSubtotal, manualDiscount, booking]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex gap-1 p-1 bg-aegean-50 rounded-xl">
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
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4">
            {error}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
        <div className="min-h-[280px]">
        {activeTab === 'stay' && (
          <Panel
            title="Room & dates"
            hint="Past check-in is allowed for late recording / SOA. Rebooking uses weekday (Mon–Thu) and weekend (Fri–Sun) rates per night."
          >
            <Field label="Room" required>
              <select
                required
                value={form.room_id}
                onChange={(e) => update({ room_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Select room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Check-in" required>
                <input
                  type="date"
                  required
                  value={form.check_in}
                  onChange={(e) => {
                    const value = e.target.value;
                    const earliest = minCheckOutDate(value);
                    const patch = { check_in: value };
                    if (earliest && form.check_out && form.check_out <= value) {
                      patch.check_out = earliest;
                    }
                    update(patch);
                    setError('');
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="Check-out" required>
                <input
                  type="date"
                  required
                  min={minCheckOutDate(form.check_in)}
                  value={form.check_out}
                  onChange={(e) => {
                    update({ check_out: e.target.value });
                    setError('');
                  }}
                  className={inputClass}
                />
              </Field>
            </div>
            {isPastStayDate(form.check_in) && (
              <p className="text-xs text-aegean-600 bg-aegean-50 border border-aegean-100 rounded-lg px-3 py-2 mt-3">
                Ante-dated stay — for recording / Statement of Account.
              </p>
            )}
            <div>
              <p className="text-sm font-medium text-aegean-700 mb-3">Guests</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Adults" required>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.adults}
                    onChange={(e) => update({ adults: e.target.value })}
                    className={inputClass}
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
            </div>
            {stayDatesChanged && (
              <RebookPricePreview quote={rebookQuote} loading={rebookQuoteLoading} />
            )}
          </Panel>
        )}

        {activeTab === 'guest' && (
          <Panel title="Lead guest" hint="Contact details from the booking form.">
            <Field label="Full name" required>
              <input
                required
                value={form.guest_name}
                onChange={(e) => update({ guest_name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Phone" required>
                <input
                  type="tel"
                  required
                  value={form.guest_phone}
                  onChange={(e) => update({ guest_phone: e.target.value })}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={inputClass}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  required
                  value={form.guest_email}
                  onChange={(e) => update({ guest_email: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Valid ID">
                <input
                  value={form.valid_id}
                  onChange={(e) => update({ valid_id: e.target.value })}
                  className={inputClass}
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
              data={form.bookingExtras}
              onChange={(bookingExtras) => update({ bookingExtras })}
              roomType={roomType}
            />
            <div className="border-t border-aegean-100 pt-5">
              <IslandHoppingSection
                embedded
                enabled={form.islandHoppingEnabled}
                onEnabledChange={(yes) => update({ islandHoppingEnabled: yes })}
                data={form.islandHopping}
                onChange={(islandHopping) => update({ islandHopping })}
              />
            </div>
          </Panel>
        )}

        {activeTab === 'custom-addons' && (
          <Panel
            title="Extra charges"
            hint="Room extension, ordered food, and other during-stay charges (admin only)."
          >
            <BookingCustomAddons
              bookingId={booking.id}
              addons={booking.addons || []}
              onBookingUpdated={(updated) => {
                if (updated) onSaved?.(updated);
              }}
            />
          </Panel>
        )}

        {activeTab === 'payment' && (
          <Panel title="Payment & notes">
            {(paymentMethods.length > 0 || MANUAL_ONLY_PAYMENT_METHODS.length > 0) && (
              <Field label="Payment method">
                <select
                  value={form.payment_method_id}
                  onChange={(e) => update({ payment_method_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">None selected</option>
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
              maxAmount={grossRoomSubtotal}
              promoCode={booking.discount_code}
              promoAmount={booking.discount_amount}
            />
            <PaymentAmountSelect
              totalAmount={
                paymentPreviewTotal > 0 ? paymentPreviewTotal : Number(booking.total_amount)
              }
              depositPercent={depositPercent}
              paymentOption={form.payment_option}
              customAmount={form.custom_payment_amount}
              onOptionChange={(id) => update({ payment_option: id })}
              onCustomAmountChange={(val) => update({ custom_payment_amount: val })}
            />
            <p className="text-xs text-aegean-500 -mt-2">
              Estimated total: ₱{paymentPreviewTotal.toLocaleString()}
              {stayDatesChanged && rebookQuote && !rebookQuote.error ? (
                <>
                  {' '}
                  ·{' '}
                  {rebookQuote.adjustment_type === 'additional_charge'
                    ? `+₱${rebookQuote.adjustment_amount.toLocaleString()} vs current stay`
                    : rebookQuote.adjustment_type === 'refund'
                      ? `−₱${rebookQuote.adjustment_amount.toLocaleString()} vs current stay`
                      : 'same as current stay'}
                </>
              ) : null}
            </p>
            <div className="border-t border-aegean-100 pt-4 space-y-4">
              <Field label="Special requests">
                <textarea
                  rows={3}
                  value={form.special_requests}
                  onChange={(e) => update({ special_requests: e.target.value })}
                  className={inputClass}
                  placeholder="Guest requests from booking form"
                />
              </Field>
              <Field label="Admin notes (internal)">
                <textarea
                  rows={2}
                  value={form.admin_notes}
                  onChange={(e) => update({ admin_notes: e.target.value })}
                  className={inputClass}
                  placeholder="Staff-only notes"
                />
              </Field>
            </div>
          </Panel>
        )}
        </div>
      </div>

      <div className="shrink-0 border-t border-aegean-100 px-6 py-4 bg-white flex flex-wrap items-center justify-between gap-3">
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
            <button
              type="button"
              onClick={() => {
                const idx = TABS.findIndex((t) => t.id === activeTab);
                if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
              }}
              className="btn-primary text-sm"
            >
              Next
            </button>
          ) : (
            <SubmitButton loading={saving} loadingLabel="Saving..." className="text-sm">
              Save all changes
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
