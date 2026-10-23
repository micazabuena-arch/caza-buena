import { getStayDateError, minCheckOutDate, isPastStayDate } from './stayDates';
import { roomLineGuestCount } from './bookingRoomLines';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidGuestEmail(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

export function isValidGuestPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 7;
}

/**
 * Soft capacity warnings for admin override (over max_guests).
 * Public booking must not use this — keep hard blocks there.
 */
export function collectOverCapacityWarnings(roomLines = [], rooms = [], lineQuotes = {}) {
  const warnings = [];
  for (const line of roomLines) {
    if (!line.room_id) continue;
    const room = rooms.find((r) => String(r.id) === String(line.room_id));
    if (!room) continue;
    const quote = lineQuotes[line.id];
    const maxG =
      quote?.room_limits?.max_guests ?? room.max_guests ?? room.capacity ?? 99;
    const count = roomLineGuestCount(line);
    if (count > maxG) {
      warnings.push(
        `${room.name} allows up to ${maxG} guest(s). You selected ${count}.`
      );
    } else if (quote?.occupancy_error) {
      // API may still report composition / occupancy text even when totals match max.
      warnings.push(quote.occupancy_error);
    }
  }
  return warnings;
}

/**
 * Validate manual booking fields for a tab or full form.
 * Returns { fieldErrors, bannerError, capacityWarnings, firstTabWithError }.
 * Past check-in is allowed (admin ante-date / late recording for SOA).
 * Supports multi-room via context.roomLines + context.lineQuotes.
 *
 * When context.allowOverCapacity is true (admin manual / quote→booking), guest counts
 * above room max become soft warnings instead of hard errors.
 */
export function validateManualBookingFields(form, context = {}) {
  const {
    tab = 'all',
    roomLines = null,
    lineQuotes = {},
    lineQuotesLoading = false,
    rooms = [],
    paymentMethods = [],
    manualOnlyPaymentMethods = [],
    extrasQuote,
    islandHoppingEnabled,
    islandQuote,
    islandHopping = null,
    totalAmount,
    customPay,
    roomSubtotal,
    allowOverCapacity = false,
    // Legacy single-room fields (kept for backwards compatibility)
    availability,
    availabilityChecking,
    selectedRoom,
    guestCount,
  } = context;

  const fieldErrors = {};
  let bannerError = null;
  let firstTabWithError = null;
  const capacityWarnings = [];

  const markTab = (tabId) => {
    if (!firstTabWithError) firstTabWithError = tabId;
  };

  const need = (tabIds) => tab === 'all' || tabIds.includes(tab);
  const useRoomLines = Array.isArray(roomLines) && roomLines.length > 0;
  const anteDate = isPastStayDate(form.check_in);

  if (need(['stay'])) {
    if (!form.check_in) {
      fieldErrors.check_in = 'Check-in date is required.';
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

    if (useRoomLines) {
      if (roomLines.some((line) => !line.room_id)) {
        fieldErrors.room_id = 'Please select a room for every line.';
        markTab('stay');
      }

      const roomIds = roomLines.filter((l) => l.room_id).map((l) => String(l.room_id));
      if (new Set(roomIds).size !== roomIds.length) {
        bannerError = 'Each room can only be booked once per reservation.';
        markTab('stay');
      }

      for (const line of roomLines) {
        if (!line.room_id) continue;
        const room = rooms.find((r) => String(r.id) === String(line.room_id));
        const count = roomLineGuestCount(line);
        const maxG = room?.max_guests ?? room?.capacity ?? 99;
        if ((parseInt(line.adults, 10) || 0) < 1) {
          fieldErrors.adults = 'Each room needs at least 1 adult.';
          markTab('stay');
        }
        if (room && count > maxG) {
          if (allowOverCapacity) {
            capacityWarnings.push(
              `${room.name} allows up to ${maxG} guest(s). You selected ${count}.`
            );
          } else {
            fieldErrors.adults = `${room.name} allows up to ${maxG} guests.`;
            markTab('stay');
          }
        }
        if (room && count < (room.min_guests ?? 1)) {
          fieldErrors.adults = `${room.name} requires at least ${room.min_guests ?? 1} guest(s).`;
          markTab('stay');
        }
      }

      if (!dateError && roomLines.every((line) => line.room_id)) {
        if (lineQuotesLoading) {
          bannerError = 'Checking availability for these dates…';
          markTab('stay');
        } else {
          for (const line of roomLines) {
            const quote = lineQuotes[line.id];
            const room = rooms.find((r) => String(r.id) === String(line.room_id));
            const label = room?.name || 'Room';
            if (quote?.occupancy_error) {
              if (allowOverCapacity) {
                // Soft: staff confirm on submit; do not block Next / Create.
                if (!capacityWarnings.includes(quote.occupancy_error)) {
                  capacityWarnings.push(quote.occupancy_error);
                }
              } else {
                bannerError = `${label}: ${quote.occupancy_error}`;
                markTab('stay');
                break;
              }
            }
            // available=false can mean calendar conflict OR occupancy_error on the API.
            // When over-capacity only, still allow pricing / proceed for admin.
            const calendarBlocked =
              quote && !quote.available && !quote.occupancy_error && !anteDate;
            if (calendarBlocked) {
              bannerError = `${label} is not available for these dates.`;
              markTab('stay');
              break;
            }
            if (anteDate && quote?.subtotal == null && !lineQuotesLoading) {
              bannerError = `Unable to price ${label}. Check the room and dates.`;
              markTab('stay');
              break;
            }
          }
        }
      }
    } else {
      // Legacy single-room validation path
      if (!form.room_id) {
        fieldErrors.room_id = 'Please select a room.';
        markTab('stay');
      }
      if (!fieldErrors.adults && form.adults < 1) {
        fieldErrors.adults = 'At least 1 adult is required.';
        markTab('stay');
      }
      if (selectedRoom && guestCount > (selectedRoom.max_guests ?? selectedRoom.capacity ?? 99)) {
        const maxG = selectedRoom.max_guests ?? selectedRoom.capacity;
        if (allowOverCapacity) {
          capacityWarnings.push(`This room allows up to ${maxG} guests.`);
        } else {
          fieldErrors.adults = `This room allows up to ${maxG} guests.`;
          markTab('stay');
        }
      }
      if (form.room_id && !dateError) {
        if (availabilityChecking) {
          bannerError = 'Checking availability for these dates…';
          markTab('stay');
        } else if (availability?.occupancy_error) {
          if (allowOverCapacity) {
            capacityWarnings.push(availability.occupancy_error);
          } else {
            bannerError = availability.occupancy_error;
            markTab('stay');
          }
        } else if (!availability?.available && !anteDate) {
          bannerError = 'Room is not available for these dates.';
          markTab('stay');
        } else if (anteDate && availability?.subtotal == null && !availabilityChecking) {
          bannerError = 'Unable to price this stay. Check the room and dates.';
          markTab('stay');
        }
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
      if (islandHopping?.soa_summary) {
        const pax = parseInt(islandHopping.summary_pax, 10);
        const amount = parseFloat(islandHopping.summary_amount);
        if (!Number.isFinite(pax) || pax < 1) {
          bannerError = 'Enter the number of island hopping passengers.';
          markTab('addons');
        } else if (!Number.isFinite(amount) || amount < 0) {
          bannerError = 'Enter a valid island hopping amount.';
          markTab('addons');
        }
      } else if (islandQuote?.error) {
        bannerError = islandQuote.error;
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

  return { fieldErrors, bannerError, capacityWarnings, firstTabWithError };
}

export { minCheckOutDate };
