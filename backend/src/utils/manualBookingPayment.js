export const MANUAL_PAYMENT_NOTE_PREFIX = 'Payment method (manual): ';
export const MANUAL_BOOKING_TAG = 'Manual booking (admin)';

function isSystemAdminNotePart(part) {
  const trimmed = String(part || '').trim();
  return trimmed.startsWith(MANUAL_PAYMENT_NOTE_PREFIX) || trimmed === MANUAL_BOOKING_TAG;
}

/** User-editable admin notes only — strips payment labels and manual-booking tags. */
export function stripManualPaymentFromNotes(adminNotes) {
  if (!adminNotes) return '';
  return String(adminNotes)
    .split(' — ')
    .filter((p) => !isSystemAdminNotePart(p))
    .join(' — ')
    .trim();
}

export function getManualPaymentMethodFromNotes(adminNotes) {
  if (!adminNotes) return null;
  const part = String(adminNotes)
    .split(' — ')
    .find((p) => p.startsWith(MANUAL_PAYMENT_NOTE_PREFIX));
  return part ? part.slice(MANUAL_PAYMENT_NOTE_PREFIX.length) : null;
}

export function buildAdminNotesWithManualPayment({
  userNotes,
  manualPaymentLabel,
  existingNotes,
  includeManualBookingTag = false,
}) {
  const parts = [];
  const cleanedUser = stripManualPaymentFromNotes(userNotes);
  if (cleanedUser) parts.push(cleanedUser);
  if (manualPaymentLabel?.trim()) {
    parts.push(`${MANUAL_PAYMENT_NOTE_PREFIX}${manualPaymentLabel.trim()}`);
  }
  const keepManualBookingTag =
    includeManualBookingTag || String(existingNotes || '').includes(MANUAL_BOOKING_TAG);
  if (keepManualBookingTag) {
    parts.push(MANUAL_BOOKING_TAG);
  }
  return parts.length ? parts.join(' — ') : null;
}

export function resolveStoredManualPayment({ manual_payment_method, payment_method_id, existingBooking }) {
  if (manual_payment_method?.trim()) {
    return { payment_method_id: null, manualPaymentLabel: manual_payment_method.trim() };
  }
  if (payment_method_id !== undefined) {
    return { payment_method_id: payment_method_id || null, manualPaymentLabel: null };
  }
  if (existingBooking.payment_method_id) {
    return {
      payment_method_id: existingBooking.payment_method_id,
      manualPaymentLabel: null,
    };
  }
  return {
    payment_method_id: null,
    manualPaymentLabel: getManualPaymentMethodFromNotes(existingBooking.admin_notes),
  };
}
