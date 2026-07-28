/** Itemized bilao / boodle fight lines from validateBookingExtras() output. */
export default function FoodAddOnsOrderSummary({
  extrasQuote,
  bookingExtras,
  compact = false,
  showHints = false,
}) {
  if (!extrasQuote) return null;

  const bilaoItems = extrasQuote.valid ? extrasQuote.bilao_items || [] : [];
  const boodleItems = extrasQuote.valid ? extrasQuote.boodle_items || [] : [];
  const bilaoTotal = extrasQuote.valid ? extrasQuote.bilao_amount || 0 : 0;
  const boodleTotal = extrasQuote.valid ? extrasQuote.boodle_fight_amount || 0 : 0;
  const hasFood = bilaoTotal > 0 || boodleTotal > 0;

  const rowClass = compact
    ? 'flex justify-between gap-4 text-xs text-aegean-600'
    : 'flex justify-between text-aegean-700';

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {hasFood && (
        <>
          {!compact && <p className="text-sm font-medium text-aegean-800">Food add-ons</p>}
          {bilaoItems.map(({ package: pkg, qty, subtotal }) => (
            <div key={`bilao-${pkg.id}`} className={rowClass}>
              <span>
                Bilao — {pkg.label}
                {qty > 1 ? ` × ${qty}` : ''}
              </span>
              <span className="shrink-0">₱{subtotal.toLocaleString()}</span>
            </div>
          ))}
          {boodleItems.map(({ package: pkg, qty, subtotal }) => (
            <div key={`boodle-${pkg.id}`} className={rowClass}>
              <span>
                Boodle fight — {pkg.label}
                {qty > 1 ? ` × ${qty}` : ''}
              </span>
              <span className="shrink-0">₱{subtotal.toLocaleString()}</span>
            </div>
          ))}
          {!compact && (bilaoTotal > 0 || boodleTotal > 0) && (
            <div className="flex justify-between text-xs font-medium text-aegean-700 pt-1 border-t border-aegean-100">
              <span>Food subtotal</span>
              <span>₱{(bilaoTotal + boodleTotal).toLocaleString()}</span>
            </div>
          )}
        </>
      )}

      {showHints && bookingExtras?.bilao_enabled && !bilaoTotal && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          Enter Bilao quantities above to include them in the total.
        </p>
      )}
      {showHints && bookingExtras?.boodle_fight_enabled && !boodleTotal && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          Enter Boodle fight quantities above to include them in the total.
        </p>
      )}
    </div>
  );
}
