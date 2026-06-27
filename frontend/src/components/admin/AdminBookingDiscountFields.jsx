const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-aegean-700 mb-1.5">{label}</span>
      {children}
      {hint && <p className="text-xs text-aegean-500 mt-1">{hint}</p>}
    </label>
  );
}

/**
 * Optional per-guest discount for admin manual bookings (room stay only).
 */
export default function AdminBookingDiscountFields({
  amount,
  note,
  onAmountChange,
  onNoteChange,
  maxAmount,
  error,
  promoCode,
  promoAmount,
}) {
  if (promoCode) {
    return (
      <div className="rounded-lg border border-aegean-100 bg-aegean-50/80 px-3 py-2.5 text-sm text-aegean-700">
        <p className="font-medium text-aegean-800">Promo code applied</p>
        <p className="text-xs text-aegean-600 mt-0.5">
          {promoCode}
          {Number(promoAmount) > 0 ? ` · −₱${Number(promoAmount).toLocaleString()}` : ''}
        </p>
        <p className="text-xs text-aegean-500 mt-1">
          This booking used an online promo code. To change it, adjust the promo on the Discounts
          page or contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-aegean-100 bg-white p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-aegean-800">Special discount (optional)</p>
        <p className="text-xs text-aegean-500 mt-0.5">
          One-off discount for this guest — applied to room stay only (before island hopping &amp;
          food add-ons).
          {maxAmount > 0 ? ` Max ₱${Math.round(maxAmount).toLocaleString()}.` : ''}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Discount amount (₱)">
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className={inputClass}
            placeholder="0"
          />
        </Field>
        <Field label="Reason / note" hint="Shown internally and on SOA when set.">
          <input
            type="text"
            maxLength={255}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            className={inputClass}
            placeholder="e.g. Returning guest, staff referral"
          />
        </Field>
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
