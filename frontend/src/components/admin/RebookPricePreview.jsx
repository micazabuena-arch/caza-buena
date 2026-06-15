function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString()}`;
}

function nightSummary(summary) {
  if (!summary) return null;
  const parts = [];
  if (summary.weekday) parts.push(`${summary.weekday} weekday`);
  if (summary.weekend) parts.push(`${summary.weekend} weekend`);
  if (summary.holiday) parts.push(`${summary.holiday} holiday`);
  return parts.length ? parts.join(' · ') : '0 nights';
}

export default function RebookPricePreview({ quote, loading, compact = false }) {
  if (loading) {
    return <p className="text-xs text-aegean-500">Calculating rates for new dates…</p>;
  }
  if (!quote || quote.error) {
    if (quote?.error) {
      return <p className="text-xs text-red-600">{quote.error}</p>;
    }
    return null;
  }

  const datesChanged =
    quote.new_check_in !== quote.previous_check_in ||
    quote.new_check_out !== quote.previous_check_out;

  if (!datesChanged && quote.adjustment_type === 'unchanged') {
    return (
      <p className="text-xs text-aegean-500">
        Total stays at {formatPeso(quote.new_total_amount)} for these dates.
      </p>
    );
  }

  const isCharge = quote.adjustment_type === 'additional_charge';
  const isRefund = quote.adjustment_type === 'refund';
  const boxClass = isCharge
    ? 'border-amber-200 bg-amber-50'
    : isRefund
      ? 'border-emerald-200 bg-emerald-50'
      : 'border-aegean-100 bg-aegean-50';

  return (
    <div className={`rounded-lg border p-3 text-sm space-y-2 ${boxClass}`}>
      {isCharge && (
        <p className="font-medium text-amber-900">
          Additional charge: {formatPeso(quote.adjustment_amount)}
        </p>
      )}
      {isRefund && (
        <p className="font-medium text-emerald-900">
          Refund owed: {formatPeso(quote.adjustment_amount)}
        </p>
      )}
      {quote.adjustment_type === 'unchanged' && datesChanged && (
        <p className="font-medium text-aegean-800">Total unchanged for the new dates.</p>
      )}

      <p className="text-xs text-aegean-700">
        {formatPeso(quote.previous_total_amount)} → {formatPeso(quote.new_total_amount)}
        {quote.previous_nights !== quote.new_nights
          ? ` · ${quote.previous_nights} → ${quote.new_nights} night(s)`
          : ''}
      </p>

      {!compact && (
        <>
          <p className="text-xs text-aegean-600">
            Was: {nightSummary(quote.previous_breakdown_summary)} · Now:{' '}
            {nightSummary(quote.new_breakdown_summary)}
          </p>
          <p className="text-xs text-aegean-500">{quote.rate_note}</p>
          {quote.amount_to_pay_difference !== 0 && (
            <p className="text-xs text-aegean-600">
              Amount due now: {formatPeso(quote.previous_amount_to_pay)} →{' '}
              {formatPeso(quote.new_amount_to_pay)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function rebookConfirmMessage(quote, referenceCode, checkIn, checkOut) {
  const base = `Change ${referenceCode} to ${checkIn} → ${checkOut}?`;
  if (!quote || quote.adjustment_type === 'unchanged') {
    return `${base} Pricing will be recalculated for the new dates.`;
  }
  if (quote.adjustment_type === 'additional_charge') {
    return `${base} The guest will owe an additional ${formatPeso(quote.adjustment_amount)} (weekend rates are higher). New total: ${formatPeso(quote.new_total_amount)}.`;
  }
  return `${base} The guest is owed a refund of ${formatPeso(quote.adjustment_amount)} (weekday rates are lower). New total: ${formatPeso(quote.new_total_amount)}.`;
}

export function rebookSuccessMessage(quote) {
  if (!quote || quote.adjustment_type === 'unchanged') {
    return 'Stay dates updated.';
  }
  if (quote.adjustment_type === 'additional_charge') {
    return `Stay dates updated. Collect additional ${formatPeso(quote.adjustment_amount)} from the guest.`;
  }
  return `Stay dates updated. Refund ${formatPeso(quote.adjustment_amount)} to the guest.`;
}
