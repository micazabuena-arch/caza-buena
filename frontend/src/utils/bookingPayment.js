const PAID_STATUSES = new Set(['confirmed', 'payment_submitted']);

const TYPE_LABELS = {
  deposit: 'Down payment',
  partial: 'Partial payment',
  full: 'Full payment',
  custom: 'Custom payment',
};

export function formatPaymentOption(option) {
  if (!option) return null;
  return TYPE_LABELS[option] || option.replace(/_/g, ' ');
}

export function paymentTypeLabel(type) {
  return formatPaymentOption(type) || 'Payment';
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Upfront amount + balance for admin/guest payment summaries.
 * When booking.payments exists, payNow is the sum of the series (DP + partial + …).
 */
export function getBookingPaymentSummary(booking) {
  const total = Number(booking?.total_amount) || 0;
  const payments = Array.isArray(booking?.payments) ? booking.payments : [];
  const paymentsTotal = roundMoney(
    payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  );
  const payNow =
    payments.length > 0
      ? paymentsTotal
      : Number(booking?.amount_to_pay ?? booking?.total_amount) || 0;
  const balance = Math.max(0, roundMoney(total - payNow));
  const isPartial = balance > 0;
  const treatedAsPaid = PAID_STATUSES.has(booking?.status) || payments.length > 0;

  return {
    total,
    payNow,
    balance,
    isPartial,
    payments,
    paymentLines: payments.map((row) => ({
      id: row.id,
      label: paymentTypeLabel(row.payment_type),
      amount: Number(row.amount) || 0,
      note: row.note || '',
      paid_at: row.paid_at,
    })),
    upfrontLabel: treatedAsPaid ? 'Amount paid' : 'Pay now',
    paymentOptionLabel:
      payments.length === 1
        ? paymentTypeLabel(payments[0].payment_type)
        : payments.length > 1
          ? null
          : formatPaymentOption(booking?.payment_option),
  };
}
