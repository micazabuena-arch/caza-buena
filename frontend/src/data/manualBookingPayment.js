/** Payment options shown only in admin manual booking — not stored in payment_methods. */
export const MANUAL_ONLY_PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash' },
  { id: 'online_platform', name: 'Online Booking Platform' },
];

export const MANUAL_PAYMENT_NOTE_PREFIX = 'Payment method (manual): ';

export function isManualOnlyPaymentMethodId(id) {
  return MANUAL_ONLY_PAYMENT_METHODS.some((m) => m.id === id);
}

export function getManualOnlyPaymentMethodName(id) {
  return MANUAL_ONLY_PAYMENT_METHODS.find((m) => m.id === id)?.name ?? null;
}

export function getManualPaymentMethodFromNotes(adminNotes) {
  if (!adminNotes) return null;
  const part = String(adminNotes)
    .split(' — ')
    .find((p) => p.startsWith(MANUAL_PAYMENT_NOTE_PREFIX));
  return part ? part.slice(MANUAL_PAYMENT_NOTE_PREFIX.length) : null;
}

export function getBookingPaymentMethodLabel(booking) {
  return (
    booking?.payment_method_name ||
    getManualPaymentMethodFromNotes(booking?.admin_notes) ||
    null
  );
}

/** Map stored manual payment label back to the edit-form dropdown id. */
export function resolveEditFormPaymentMethodId(booking) {
  if (booking?.payment_method_id) return String(booking.payment_method_id);
  const manualName = getManualPaymentMethodFromNotes(booking?.admin_notes);
  if (!manualName) return '';
  const match = MANUAL_ONLY_PAYMENT_METHODS.find(
    (m) => m.name.toLowerCase() === manualName.toLowerCase()
  );
  return match?.id || '';
}

export function stripManualPaymentFromNotes(adminNotes) {
  if (!adminNotes) return '';
  return String(adminNotes)
    .split(' — ')
    .filter((p) => !p.startsWith(MANUAL_PAYMENT_NOTE_PREFIX))
    .join(' — ')
    .trim();
}
