const PAID_STATUSES = new Set(['confirmed', 'payment_submitted']);

function formatPaymentOption(option) {
  if (!option) return null;
  const labels = { deposit: 'Deposit', full: 'Full payment', custom: 'Custom amount' };
  return labels[option] || option.replace(/_/g, ' ');
}

/**
 * Upfront amount + balance for admin/guest payment summaries.
 * - Before payment is in: "Pay now"
 * - After proof submitted or confirmed: "Amount paid"
 */
export function getBookingPaymentSummary(booking) {
  const total = Number(booking?.total_amount) || 0;
  const payNow = Number(booking?.amount_to_pay ?? booking?.total_amount) || 0;
  const balance = Math.max(0, Math.round((total - payNow) * 100) / 100);
  const isPartial = balance > 0;
  const treatedAsPaid = PAID_STATUSES.has(booking?.status);

  return {
    total,
    payNow,
    balance,
    isPartial,
    upfrontLabel: treatedAsPaid ? 'Amount paid' : 'Pay now',
    paymentOptionLabel: formatPaymentOption(booking?.payment_option),
  };
}
