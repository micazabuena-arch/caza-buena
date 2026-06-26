/** Payment methods shown only in admin manual booking / edit flows. */
export const ADMIN_ONLY_PAYMENT_METHOD_NAMES = new Set(['Online Booking Platform']);

export function guestFacingPaymentMethods(methods) {
  return (methods || []).filter((m) => !ADMIN_ONLY_PAYMENT_METHOD_NAMES.has(m.name));
}

/** Guest payment picker — includes admin-only method only if already on the booking. */
export function paymentMethodsForGuestBooking(methods, booking) {
  const guest = guestFacingPaymentMethods(methods);
  if (!booking?.payment_method_id) return guest;

  const selected = (methods || []).find((m) => m.id === booking.payment_method_id);
  if (selected && ADMIN_ONLY_PAYMENT_METHOD_NAMES.has(selected.name)) {
    return [...guest, selected];
  }
  return guest;
}
