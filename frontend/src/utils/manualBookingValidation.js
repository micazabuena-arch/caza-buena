import { getStayDateError, minCheckOutDate, isPastStayDate } from './stayDates';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidGuestEmail(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

export function isValidGuestPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 7;
}

/**
 * Validate manual booking fields for a tab or full form.
 * Returns { fieldErrors, bannerError, tabId } — all fieldErrors values are strings.
 */
export function validateManualBookingFields(form, context = {}) {
  const {
    tab = 'all',
    availability,
    availabilityChecking,
    selectedRoom,
    guestCount,
    paymentMethods = [],
    manualOnlyPaymentMethods = [],
    extrasQuote,
    islandHoppingEnabled,
    islandQuote,
    islandHopping,
    totalAmount,
    customPay,
    roomSubtotal,
  } = context;

  const fieldErrors = {};
  let bannerError = null;
  let firstTabWithError = null;

  const markTab = (tabId) => {
    if (!firstTabWithError) firstTabWithError = tabId;
  };

  const need = (tabIds) => tab === 'all' || tabIds.includes(tab);

  if (need(['stay'])) {
    if (!form.room_id) {
      fieldErrors.room_id = 'Please select a room.';
      markTab('stay');
    }
    if (!form.check_in) {
      fieldErrors.check_in = 'Check-in date is required.';
      markTab('stay');
    } else if (isPastStayDate(form.check_in)) {
      fieldErrors.check_in = 'Check-in cannot be in the past.';
      markTab('stay');
    }
    if (!form.check_out) {
      fieldErrors.check_out = 'Check-out date is required.';
      markTab('stay');
    }
    const dateError = getStayDateError(form.check_in, form.check_out);
    if (dateError) {
      fieldErrors.check_out = dateError;
      markTab('stay');
    }
    if (!fieldErrors.adults && form.adults < 1) {
      fieldErrors.adults = 'At least 1 adult is required.';
      markTab('stay');
    }
    if (selectedRoom && guestCount > (selectedRoom.max_guests ?? selectedRoom.capacity ?? 99)) {
      fieldErrors.adults = `This room allows up to ${selectedRoom.max_guests ?? selectedRoom.capacity} guests.`;
      markTab('stay');
    }
    if (form.room_id && !dateError) {
      if (availabilityChecking) {
        bannerError = 'Checking availability for these dates…';
        markTab('stay');
      } else if (!availability?.available) {
        bannerError =
          availability?.occupancy_error || 'Room is not available for these dates.';
        markTab('stay');
      }
    }
  }

  if (need(['guest'])) {
    if (!form.guest_name?.trim()) {
      fieldErrors.guest_name = 'Guest name is required.';
      markTab('guest');
    } else if (form.guest_name.trim().length < 2) {
      fieldErrors.guest_name = 'Please enter the guest’s full name.';
      markTab('guest');
    }

    if (!form.guest_phone?.trim()) {
      fieldErrors.guest_phone = 'Phone number is required.';
      markTab('guest');
    } else if (!isValidGuestPhone(form.guest_phone)) {
      fieldErrors.guest_phone = 'Enter a valid phone number (at least 7 digits).';
      markTab('guest');
    }

    if (!form.guest_email?.trim()) {
      fieldErrors.guest_email = 'Email is required.';
      markTab('guest');
    } else if (!isValidGuestEmail(form.guest_email)) {
      fieldErrors.guest_email = 'Enter a valid email address (e.g. name@email.com).';
      markTab('guest');
    }

    if (!form.valid_id?.trim()) {
      fieldErrors.valid_id = 'Valid ID type and number is required.';
      markTab('guest');
    } else if (form.valid_id.trim().length < 3) {
      fieldErrors.valid_id = 'Please enter the ID type and number (e.g. Driver’s License — N01-123456).';
      markTab('guest');
    }
  }

  if (need(['addons'])) {
    if (extrasQuote && !extrasQuote.valid) {
      bannerError = extrasQuote.message;
      markTab('addons');
    }
    if (islandHoppingEnabled) {
      if (islandQuote?.error) {
        bannerError = islandQuote.error;
        markTab('addons');
      } else if (!islandQuote?.complete) {
        bannerError = 'Complete all island hopping passenger details or turn island hopping off.';
        markTab('addons');
      } else if (!islandHopping.passenger_address?.trim()) {
        bannerError = 'Passenger address is required for island hopping.';
        markTab('addons');
      } else if (
        !islandHopping.payor_name?.trim() ||
        !islandHopping.payor_address?.trim() ||
        !islandHopping.payor_phone?.trim()
      ) {
        bannerError = 'Complete payor name, address, and phone for island hopping.';
        markTab('addons');
      } else if (
        !islandHopping.emergency_contact_name?.trim() ||
        !islandHopping.emergency_contact_phone?.trim()
      ) {
        bannerError = 'Complete emergency contact name and phone for island hopping.';
        markTab('addons');
      }
    }
  }

  if (need(['payment'])) {
    const hasPaymentOptions =
      paymentMethods.length > 0 || manualOnlyPaymentMethods.length > 0;
    if (hasPaymentOptions && !form.payment_method_id) {
      fieldErrors.payment_method_id = 'Select a payment method.';
      markTab('payment');
    }
    if (form.payment_option === 'custom') {
      if (!Number.isFinite(customPay) || customPay <= 0) {
        fieldErrors.custom_payment_amount = 'Enter a valid payment amount greater than zero.';
        markTab('payment');
      } else if (customPay > totalAmount) {
        fieldErrors.custom_payment_amount = 'Amount cannot exceed the booking total.';
        markTab('payment');
      }
    }
    const discountRaw = parseFloat(form.admin_discount_amount);
    if (form.admin_discount_amount !== '' && form.admin_discount_amount != null) {
      if (!Number.isFinite(discountRaw) || discountRaw < 0) {
        fieldErrors.admin_discount_amount = 'Enter a valid discount amount (zero or greater).';
        markTab('payment');
      } else if (discountRaw > 0 && roomSubtotal > 0 && discountRaw > roomSubtotal) {
        fieldErrors.admin_discount_amount = `Discount cannot exceed room stay total (₱${Math.round(roomSubtotal).toLocaleString()}).`;
        markTab('payment');
      }
    }
  }

  return { fieldErrors, bannerError, firstTabWithError };
}

export { minCheckOutDate };
