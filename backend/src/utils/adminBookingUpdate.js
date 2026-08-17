import { calculateNights, isRoomAvailable, isAnteDateCheckIn } from './booking.js';
import { resolveAdminBookingDiscount } from './adminBookingDiscount.js';
import {
  buildAdminNotesWithManualPayment,
  resolveStoredManualPayment,
  stripManualPaymentFromNotes,
} from './manualBookingPayment.js';
import { normalizeRoomLines, validateAndPriceRoomLines } from './bookingRooms.js';

/**
 * Validates and computes pricing for an admin booking update.
 * Returns { error } or { values, pricedLines? } ready for UPDATE.
 */
export async function computeAdminBookingUpdate(pool, existingBooking, body) {
  const {
    room_id,
    room_lines: roomLinesBody,
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
    bilao_lines,
    boodle_fight_enabled,
    boodle_fight_tier,
    boodle_lines,
    island_hopping: islandHoppingFlag,
    island_hopping_data: islandHoppingData,
    admin_discount_amount,
    admin_discount_note,
  } = body;

  const checkIn = String(check_in ?? existingBooking.check_in).slice(0, 10);
  const checkOut = String(check_out ?? existingBooking.check_out).slice(0, 10);
  const nights = calculateNights(checkIn, checkOut);
  if (nights < 1) return { error: 'Check-out must be after check-in' };

  const hasRoomLines = Array.isArray(roomLinesBody) && roomLinesBody.length > 0;
  const blocksAvailability = ['pending', 'awaiting_payment', 'payment_submitted', 'confirmed'].includes(
    existingBooking.status
  );
  const skipAvailabilityCheck =
    !blocksAvailability || isAnteDateCheckIn(checkIn);

  let roomId;
  let room;
  let hasSuite = false;
  let adultsN;
  let childrenUnder6;
  let children712;
  let guestCount;
  let staySubtotal;
  let extraPersonCharges;
  let avgNightlyRate;
  let pricedLines = null;

  if (hasRoomLines) {
    const rawLines = normalizeRoomLines({
      room_id,
      room_lines: roomLinesBody,
      adults,
      children_under6,
      children_7_12,
    });

    const priced = await validateAndPriceRoomLines(pool, checkIn, checkOut, rawLines, {
      skipAvailabilityCheck,
      allowInactiveRooms: true,
      excludeBookingId: existingBooking.id,
    });
    if (priced.error) return { error: priced.error };

    pricedLines = priced.lines;
    room = priced.primaryRoom;
    hasSuite = priced.hasSuite;
    roomId = pricedLines[0].room_id;
    adultsN = priced.totalAdults;
    childrenUnder6 = priced.totalUnder6;
    children712 = priced.total712;
    guestCount = priced.totalGuests;
    staySubtotal = priced.combinedSubtotal;
    extraPersonCharges = priced.combinedExtraCharges;
    avgNightlyRate = nights > 0 ? staySubtotal / nights : Number(room.price_per_night);
  } else {
    roomId = parseInt(room_id ?? existingBooking.room_id, 10);
    adultsN = parseInt(adults ?? existingBooking.adults ?? 1, 10);
    childrenUnder6 = parseInt(children_under6, 10) || 0;
    children712 = parseInt(children_7_12, 10) || 0;
    guestCount = adultsN + childrenUnder6 + children712;

    const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (rooms.length === 0) return { error: 'Room not found' };
    room = rooms[0];

    if (!skipAvailabilityCheck) {
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

    staySubtotal = stay.subtotal;
    extraPersonCharges = stay.extraPersonCharges || 0;
    avgNightlyRate = nights > 0 ? stay.subtotal / nights : Number(room.price_per_night);
  }

  const discountResolved = await resolveAdminBookingDiscount(pool, {
    staySubtotal,
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
    const { resolveAdminIslandHoppingPricing } = await import('./islandHopping.js');
    const { getIslandHoppingRates } = await import('./islandHoppingRatesStore.js');
    const ihData = islandHoppingData || {};
    const islandRates = await getIslandHoppingRates(pool);
    const resolved = resolveAdminIslandHoppingPricing(ihData, existingIsland, islandRates);
    if (resolved.error) return { error: resolved.error };
    islandHoppingAmount = resolved.amount;
    islandHoppingStored = resolved.stored;
  }

  const { validateBookingExtras, serializeFoodLines } = await import('./bookingExtras.js');
  const { getFoodAddOnRates } = await import('./foodAddOnRatesStore.js');
  const foodRates = await getFoodAddOnRates(pool);
  const extrasValidation = validateBookingExtras(
    {
      bringing_car,
      car_count,
      pet_count,
      bilao_enabled,
      bilao_package,
      bilao_lines,
      boodle_fight_enabled,
      boodle_fight_tier,
      boodle_lines,
    },
    hasSuite ? 'suite' : room.room_type,
    foodRates
  );
  if (!extrasValidation.valid) return { error: extrasValidation.message };

  const roomTotal = Math.max(0, staySubtotal - (discountResolved.amount || 0));

  // Keep during-stay JSON charges and custom booking_addons rows in the total
  const { stayAddonsTotal } = await import('./stayAddons.js');
  const duringStayTotal = stayAddonsTotal(existingBooking.stay_addons);

  const [addonRows] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM booking_addons WHERE booking_id = ?',
    [existingBooking.id]
  );
  const customAddonsTotal = Number(addonRows[0]?.total || 0);

  const total =
    roomTotal +
    islandHoppingAmount +
    extrasValidation.bilao_amount +
    extrasValidation.boodle_fight_amount +
    duringStayTotal +
    customAddonsTotal;

  // Once a payment series exists, keep amount_to_pay = sum of ledger rows
  // so editing stay details cannot wipe earlier DP / partial entries.
  const { listBookingPayments, sumPaymentAmounts } = await import('./bookingPayments.js');
  let payments = [];
  try {
    payments = await listBookingPayments(pool, existingBooking.id);
  } catch {
    payments = [];
  }

  let payOption = payment_option ?? existingBooking.payment_option ?? 'deposit';
  let amountToPay;

  if (payments.length > 0) {
    amountToPay = sumPaymentAmounts(payments);
    payOption = existingBooking.payment_option ?? payOption;
  } else {
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
    amountToPay = payResolved.amount;
  }

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
      extra_person_charges: extraPersonCharges,
      island_hopping: islandHopping ? 1 : 0,
      island_hopping_amount: islandHoppingAmount,
      island_hopping_data: islandHoppingStored ? JSON.stringify(islandHoppingStored) : null,
      bringing_car: extrasValidation.bringing_car ? 1 : 0,
      car_count: extrasValidation.car_count,
      pet_count: extrasValidation.pet_count,
      pet_deposit_amount: extrasValidation.pet_deposit_amount,
      bilao_package: extrasValidation.bilao_package,
      bilao_amount: extrasValidation.bilao_amount,
      bilao_lines: serializeFoodLines(extrasValidation.bilao_lines),
      boodle_fight: extrasValidation.boodle_fight ? 1 : 0, 
      boodle_fight_tier: extrasValidation.boodle_fight_tier,
      boodle_fight_amount: extrasValidation.boodle_fight_amount,
      boodle_lines: serializeFoodLines(extrasValidation.boodle_lines),
      payment_method_id: storedPayment.payment_method_id,
      payment_option: payOption,
      amount_to_pay: amountToPay,
    },
    pricedLines,
  };
}
