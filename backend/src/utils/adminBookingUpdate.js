import { calculateNights, isRoomAvailable } from './booking.js';
import { resolveAdminBookingDiscount } from './adminBookingDiscount.js';
import {
  buildAdminNotesWithManualPayment,
  resolveStoredManualPayment,
  stripManualPaymentFromNotes,
} from './manualBookingPayment.js';

/**
 * Validates and computes pricing for an admin booking update.
 * Returns { error } or { values } ready for UPDATE.
 */
export async function computeAdminBookingUpdate(pool, existingBooking, body) {
  const {
    room_id,
    guest_name,
    guest_email,
    guest_phone,
    valid_id,
    estimated_arrival,
    check_in,
    check_out,
    adults,
    children_under6 = 0,
    children_7_12 = 0,
    special_requests,
    admin_notes,
    payment_method_id,
    manual_payment_method,
    payment_option,
    custom_payment_amount,
    bringing_car,
    car_count,
    pet_count,
    bilao_enabled,
    bilao_package,
    boodle_fight_enabled,
    boodle_fight_tier,
    island_hopping: islandHoppingFlag,
    island_hopping_data: islandHoppingData,
    admin_discount_amount,
    admin_discount_note,
  } = body;

  const roomId = parseInt(room_id ?? existingBooking.room_id, 10);
  const adultsN = parseInt(adults ?? existingBooking.adults ?? 1, 10);
  const childrenUnder6 = parseInt(children_under6, 10) || 0;
  const children712 = parseInt(children_7_12, 10) || 0;
  const guestCount = adultsN + childrenUnder6 + children712;

  const checkIn = String(check_in ?? existingBooking.check_in).slice(0, 10);
  const checkOut = String(check_out ?? existingBooking.check_out).slice(0, 10);
  const nights = calculateNights(checkIn, checkOut);
  if (nights < 1) return { error: 'Check-out must be after check-in' };

  const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
  if (rooms.length === 0) return { error: 'Room not found' };
  const room = rooms[0];

  const blocksAvailability = ['pending', 'awaiting_payment', 'payment_submitted', 'confirmed'].includes(
    existingBooking.status
  );
  if (blocksAvailability) {
    const available = await isRoomAvailable(pool, roomId, checkIn, checkOut, existingBooking.id);
    if (!available) return { error: 'Room is not available for the selected dates' };
  }

  const { validateOccupancy } = await import('../config/resortRules.js');
  const occCheck = validateOccupancy(room, {
    adults: adultsN,
    childrenUnder6,
    children7_12: children712,
  });
  if (!occCheck.valid) return { error: occCheck.message };

  const { calculateStayTotal } = await import('./pricing.js');
  const stay = await calculateStayTotal(pool, roomId, checkIn, checkOut, {
    adults: adultsN,
    childrenUnder6,
    children7_12: children712,
  });

  const discountResolved = await resolveAdminBookingDiscount(pool, {
    staySubtotal: stay.subtotal,
    nights,
    discount_code: existingBooking.discount_code || null,
    admin_discount_amount:
      admin_discount_amount !== undefined
        ? admin_discount_amount
        : existingBooking.discount_code
          ? undefined
          : existingBooking.discount_amount,
    admin_discount_note:
      admin_discount_note !== undefined
        ? admin_discount_note
        : existingBooking.discount_code
          ? undefined
          : existingBooking.discount_note,
  });
  if (discountResolved.error) return { error: discountResolved.error };

  let islandHopping = Boolean(islandHoppingFlag);
  let islandHoppingAmount = 0;
  let islandHoppingStored = null;

  const { parseIslandHoppingData } = await import('./islandHopping.js');
  const existingIsland = parseIslandHoppingData(existingBooking.island_hopping_data);

  if (islandHopping) {
    const { validateIslandHoppingPayload, calculateIslandHopping } = await import(
      './islandHopping.js'
    );
    const validation = validateIslandHoppingPayload(islandHoppingData);
    if (!validation.valid) return { error: validation.message };
    try {
      const computed = calculateIslandHopping(islandHoppingData.passengers);
      if (computed.error) return { error: computed.error };
      islandHoppingAmount = computed.total;
      const passengers = islandHoppingData.passengers.map((p, i) => ({
        ...p,
        senior_id_url: existingIsland?.passengers?.[i]?.senior_id_url ?? p.senior_id_url ?? null,
        senior_id_public_id:
          existingIsland?.passengers?.[i]?.senior_id_public_id ?? p.senior_id_public_id ?? null,
        pwd_id_url: existingIsland?.passengers?.[i]?.pwd_id_url ?? p.pwd_id_url ?? null,
        pwd_id_public_id:
          existingIsland?.passengers?.[i]?.pwd_id_public_id ?? p.pwd_id_public_id ?? null,
      }));
      islandHoppingStored = {
        passengers,
        passenger_address: islandHoppingData.passenger_address.trim(),
        payor_name: islandHoppingData.payor_name.trim(),
        payor_address: islandHoppingData.payor_address.trim(),
        payor_phone: islandHoppingData.payor_phone.trim(),
        emergency_contact_name: islandHoppingData.emergency_contact_name.trim(),
        emergency_contact_phone: islandHoppingData.emergency_contact_phone.trim(),
        breakdown: computed.breakdown,
        boat_tier: computed.boat_tier,
        boat_label: computed.boat_label,
        total: computed.total,
      };
    } catch (e) {
      return { error: e.message || 'Invalid island hopping details' };
    }
  }

  const { validateBookingExtras } = await import('./bookingExtras.js');
  const extrasValidation = validateBookingExtras(
    {
      bringing_car,
      car_count,
      pet_count,
      bilao_enabled,
      bilao_package,
      boodle_fight_enabled,
      boodle_fight_tier,
    },
    room.room_type
  );
  if (!extrasValidation.valid) return { error: extrasValidation.message };

  const roomTotal = Math.max(0, stay.subtotal - (discountResolved.amount || 0));
  const total =
    roomTotal +
    islandHoppingAmount +
    extrasValidation.bilao_amount +
    extrasValidation.boodle_fight_amount;

  const payOption = payment_option ?? existingBooking.payment_option ?? 'deposit';
  const [settingRows] = await pool.query(
    "SELECT setting_value FROM site_settings WHERE setting_key = 'booking_deposit_percent'"
  );
  const { resolveAmountToPay, getDepositPercent } = await import('./paymentAmount.js');
  const depositPercent = getDepositPercent(settingRows[0]?.setting_value);
  const customAmount =
    payOption === 'custom'
      ? custom_payment_amount ?? existingBooking.amount_to_pay
      : undefined;
  const payResolved = resolveAmountToPay(total, payOption, customAmount, depositPercent);
  if (payResolved.error) return { error: payResolved.error };

  const avgNightlyRate = nights > 0 ? stay.subtotal / nights : Number(room.price_per_night);

  const storedPayment = resolveStoredManualPayment({
    manual_payment_method,
    payment_method_id,
    existingBooking,
  });

  const resolvedAdminNotes = buildAdminNotesWithManualPayment({
    userNotes:
      admin_notes != null
        ? String(admin_notes).trim()
        : stripManualPaymentFromNotes(existingBooking.admin_notes),
    manualPaymentLabel: storedPayment.manualPaymentLabel,
    existingNotes: existingBooking.admin_notes,
  });

  return {
    values: {
      room_id: roomId,
      guest_name: String(guest_name ?? existingBooking.guest_name).trim(),
      guest_email: String(guest_email ?? existingBooking.guest_email).trim(),
      guest_phone: String(guest_phone ?? existingBooking.guest_phone).trim(),
      valid_id: valid_id != null ? String(valid_id).trim() || null : existingBooking.valid_id,
      estimated_arrival:
        estimated_arrival != null
          ? String(estimated_arrival).trim() || null
          : existingBooking.estimated_arrival,
      guest_count: guestCount,
      adults: adultsN,
      children_under6: childrenUnder6,
      children_7_12: children712,
      special_requests:
        special_requests != null ? String(special_requests).trim() || null : existingBooking.special_requests,
      admin_notes: resolvedAdminNotes,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      room_rate: avgNightlyRate,
      discount_amount: discountResolved.amount || 0,
      discount_code: discountResolved.code,
      discount_note: discountResolved.note,
      total_amount: total,
      extra_person_charges: stay.extraPersonCharges || 0,
      island_hopping: islandHopping ? 1 : 0,
      island_hopping_amount: islandHoppingAmount,
      island_hopping_data: islandHoppingStored ? JSON.stringify(islandHoppingStored) : null,
      bringing_car: extrasValidation.bringing_car ? 1 : 0,
      car_count: extrasValidation.car_count,
      pet_count: extrasValidation.pet_count,
      pet_deposit_amount: extrasValidation.pet_deposit_amount,
      bilao_package: extrasValidation.bilao_package,
      bilao_amount: extrasValidation.bilao_amount,
      boodle_fight: extrasValidation.boodle_fight ? 1 : 0,
      boodle_fight_tier: extrasValidation.boodle_fight_tier,
      boodle_fight_amount: extrasValidation.boodle_fight_amount,
      payment_method_id: storedPayment.payment_method_id,
      payment_option: payOption,
      amount_to_pay: payResolved.amount,
    },
  };
}
