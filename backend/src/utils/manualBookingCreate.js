import pool from '../config/database.js';
import { generateReferenceCode, isAnteDateCheckIn } from './booking.js';
import { sendBookingConfirmation } from '../services/email.js';
import { buildAdminNotesWithManualPayment } from './manualBookingPayment.js';
import {
  normalizeRoomLines,
  validateAndPriceRoomLines,
  insertBookingRooms,
} from './bookingRooms.js';

/**
 * Creates an admin manual booking with the same pricing fields as the public form.
 * Supports one or more rooms via body.room_lines (or legacy single room_id).
 */
export async function createManualBooking(body) {
  const {
    room_id,
    guest_name,
    guest_email,
    guest_phone,
    check_in,
    check_out,
    adults: adultsBody,
    children_under6 = 0,
    children_7_12 = 0,
    guest_count: guestCountBody,
    room_lines: roomLinesBody,
    valid_id,
    estimated_arrival,
    status = 'confirmed',
    admin_notes,
    special_requests,
    send_confirmation_email = false,
    payment_method_id,
    manual_payment_method,
    payment_option = 'full',
    custom_payment_amount,
    island_hopping: islandHoppingFlag,
    island_hopping_data: islandHoppingData,
    bringing_car: bringingCarFlag,
    car_count: carCountBody,
    pet_count: petCountBody,
    bilao_enabled: bilaoEnabledFlag,
    bilao_package: bilaoPackageBody,
    boodle_fight_enabled: boodleFightEnabledFlag,
    boodle_fight_tier: boodleFightTierBody,
    admin_discount_amount,
    admin_discount_note,
  } = body;

  const hasRoomLines = Array.isArray(roomLinesBody) && roomLinesBody.length > 0;
  if (!hasRoomLines && !room_id) {
    return { error: 'Select at least one room' };
  }

  const checkIn = String(check_in).slice(0, 10);
  const checkOut = String(check_out).slice(0, 10);

  const rawLines = normalizeRoomLines({
    room_id,
    room_lines: roomLinesBody,
    adults: adultsBody,
    children_under6,
    children_7_12,
    guest_count: guestCountBody,
  });

  // Ante-dated stays skip calendar conflicts so staff can record late bookings / SOA.
  const priced = await validateAndPriceRoomLines(pool, checkIn, checkOut, rawLines, {
    skipAvailabilityCheck: isAnteDateCheckIn(checkIn),
    allowInactiveRooms: true,
  });
  if (priced.error) return { error: priced.error };

  const {
    nights,
    lines: pricedLines,
    combinedSubtotal: subtotal,
    combinedExtraCharges: extraPersonCharges,
    totalAdults: adults,
    totalUnder6: childrenUnder6,
    total712: children712,
    totalGuests: guest_count,
    primaryRoom: room,
    hasSuite,
  } = priced;

  const avgNightlyRate = nights > 0 ? subtotal / nights : Number(room.price_per_night);

  let islandHopping = Boolean(islandHoppingFlag);
  let islandHoppingAmount = 0;
  let islandHoppingStored = null;

  if (islandHopping) {
    const { validateIslandHoppingPayloadLenient, isIslandHoppingComplete, calculateIslandHopping } =
      await import('./islandHopping.js');

    // Admin bookings allow partial island hopping details (guests may not give
    // passenger names up front). Only hard constraints (max passengers) block here.
    const ihData = islandHoppingData || {};
    const validation = validateIslandHoppingPayloadLenient(ihData);
    if (!validation.valid) return { error: validation.message };

    const trim = (v) => (v == null ? '' : String(v).trim());
    const baseStored = {
      passengers: ihData.passengers || [],
      passenger_address: trim(ihData.passenger_address),
      payor_name: trim(ihData.payor_name),
      payor_address: trim(ihData.payor_address),
      payor_phone: trim(ihData.payor_phone),
      emergency_contact_name: trim(ihData.emergency_contact_name),
      emergency_contact_phone: trim(ihData.emergency_contact_phone),
    };

    // Price the tour only when full details are present. Partial details are saved
    // with a ₱0 amount so they can be completed (and priced) later — this mirrors
    // the admin form total, which also excludes an incomplete tour.
    if (isIslandHoppingComplete(ihData)) {
      try {
        const computed = calculateIslandHopping(ihData.passengers);
        if (computed.error) return { error: computed.error };
        islandHoppingAmount = computed.total;
        islandHoppingStored = {
          ...baseStored,
          breakdown: computed.breakdown,
          boat_tier: computed.boat_tier,
          boat_label: computed.boat_label,
          total: computed.total,
        };
      } catch (e) {
        return { error: e.message || 'Invalid island hopping details' };
      }
    } else {
      islandHoppingAmount = 0;
      islandHoppingStored = baseStored;
    }
  }

  const { validateBookingExtras } = await import('./bookingExtras.js');
  const extrasValidation = validateBookingExtras(
    {
      bringing_car: bringingCarFlag,
      car_count: carCountBody,
      pet_count: petCountBody,
      bilao_enabled: bilaoEnabledFlag,
      bilao_package: bilaoPackageBody,
      boodle_fight_enabled: boodleFightEnabledFlag,
      boodle_fight_tier: boodleFightTierBody,
    },
    hasSuite ? 'suite' : room.room_type
  );
  if (!extrasValidation.valid) return { error: extrasValidation.message };

  const { resolveAdminBookingDiscount } = await import('./adminBookingDiscount.js');
  const discountResolved = await resolveAdminBookingDiscount(pool, {
    staySubtotal: subtotal,
    nights,
    discount_code: null,
    admin_discount_amount,
    admin_discount_note,
  });
  if (discountResolved.error) return { error: discountResolved.error };

  const roomTotal = Math.max(0, subtotal - (discountResolved.amount || 0));
  const total =
    roomTotal +
    islandHoppingAmount +
    extrasValidation.bilao_amount +
    extrasValidation.boodle_fight_amount;

  const [settingRows] = await pool.query(
    "SELECT setting_value FROM site_settings WHERE setting_key = 'booking_deposit_percent'"
  );
  const { resolveAmountToPay, getDepositPercent } = await import('./paymentAmount.js');
  const depositPercent = getDepositPercent(settingRows[0]?.setting_value);
  const payResolved = resolveAmountToPay(total, payment_option, custom_payment_amount, depositPercent);
  if (payResolved.error) return { error: payResolved.error };

  const reference = generateReferenceCode();
  const notes = buildAdminNotesWithManualPayment({
    userNotes: admin_notes,
    manualPaymentLabel: manual_payment_method,
    includeManualBookingTag: true,
  });
  const confirmedAt = status === 'confirmed' ? new Date() : null;

  const [result] = await pool.query(
    `INSERT INTO bookings (
      reference_code, room_id, guest_name, guest_email, guest_phone,
      valid_id, estimated_arrival, guest_count, adults, children_under6, children_7_12,
      special_requests, check_in, check_out, nights,
      room_rate, discount_amount, discount_code, discount_note, total_amount, extra_person_charges,
      island_hopping, island_hopping_amount, island_hopping_data,
      bringing_car, car_count, pet_count, pet_deposit_amount,
      bilao_package, bilao_amount, boodle_fight, boodle_fight_tier, boodle_fight_amount,
      status, admin_notes, payment_method_id, payment_option, amount_to_pay, confirmed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reference,
      pricedLines[0].room_id,
      guest_name.trim(),
      guest_email.trim(),
      guest_phone.trim(),
      valid_id?.trim() || null,
      estimated_arrival?.trim() || null,
      guest_count,
      adults,
      childrenUnder6,
      children712,
      special_requests?.trim() || null,
      checkIn,
      checkOut,
      nights,
      avgNightlyRate,
      discountResolved.amount || 0,
      discountResolved.code,
      discountResolved.note,
      total,
      extraPersonCharges || 0,
      islandHopping ? 1 : 0,
      islandHoppingAmount,
      islandHoppingStored ? JSON.stringify(islandHoppingStored) : null,
      extrasValidation.bringing_car ? 1 : 0,
      extrasValidation.car_count,
      extrasValidation.pet_count,
      extrasValidation.pet_deposit_amount,
      extrasValidation.bilao_package,
      extrasValidation.bilao_amount,
      extrasValidation.boodle_fight ? 1 : 0,
      extrasValidation.boodle_fight_tier,
      extrasValidation.boodle_fight_amount,
      status,
      notes || null,
      payment_method_id || null,
      payment_option,
      payResolved.amount,
      confirmedAt,
    ]
  );

  await insertBookingRooms(pool, result.insertId, pricedLines);

  const roomNames = pricedLines.map((l) => l.room.name).join(', ');
  const bookingRow = {
    id: result.insertId,
    reference_code: reference,
    guest_name: guest_name.trim(),
    guest_email: guest_email.trim(),
    guest_phone: guest_phone.trim(),
    check_in: checkIn,
    check_out: checkOut,
    nights,
    total_amount: total,
    discount_amount: discountResolved.amount || 0,
    discount_code: discountResolved.code,
    discount_note: discountResolved.note,
    amount_to_pay: payResolved.amount,
    status,
    room_id: pricedLines[0].room_id,
    room_name: roomNames,
    room_count: pricedLines.length,
    island_hopping: islandHopping ? 1 : 0,
    island_hopping_amount: islandHoppingAmount,
    bilao_amount: extrasValidation.bilao_amount,
    boodle_fight_amount: extrasValidation.boodle_fight_amount,
    payment_option,
  };

  let emailResult = { sent: false };
  if (send_confirmation_email && status === 'confirmed') {
    emailResult = await sendBookingConfirmation(bookingRow, { name: roomNames });
  }

  return { booking: bookingRow, emailResult };
}
