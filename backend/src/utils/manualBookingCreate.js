import pool from '../config/database.js';
import {
  generateReferenceCode,
  calculateNights,
  isRoomAvailable,
  isAnteDateCheckIn,
} from './booking.js';
import { sendBookingConfirmation } from '../services/email.js';
import { buildAdminNotesWithManualPayment } from './manualBookingPayment.js';

/**
 * Creates an admin manual booking with the same pricing fields as the public form.
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

  const adults = parseInt(adultsBody, 10) || 1;
  const childrenUnder6 = parseInt(children_under6, 10) || 0;
  const children712 = parseInt(children_7_12, 10) || 0;
  const guest_count = adults + childrenUnder6 + children712;

  const checkIn = String(check_in).slice(0, 10);
  const checkOut = String(check_out).slice(0, 10);
  const nights = calculateNights(checkIn, checkOut);
  if (nights < 1) return { error: 'Invalid date range' };

  // Ante-dated (past check-in) stays skip calendar conflicts so staff can record late bookings / SOA.
  if (!isAnteDateCheckIn(checkIn)) {
    const available = await isRoomAvailable(pool, room_id, checkIn, checkOut);
    if (!available) return { error: 'Room is not available for the selected dates' };
  }

  const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [room_id]);
  if (rooms.length === 0) return { error: 'Room not found' };

  const room = rooms[0];
  const occupancy = { adults, childrenUnder6, children7_12: children712 };

  const { validateOccupancy } = await import('../config/resortRules.js');
  const occCheck = validateOccupancy(room, occupancy);
  if (!occCheck.valid) return { error: occCheck.message };

  const { calculateStayTotal } = await import('./pricing.js');
  const stay = await calculateStayTotal(pool, room_id, checkIn, checkOut, {
    adults,
    childrenUnder6,
    children7_12: children712,
  });
  const { subtotal, extraPersonCharges, roomSubtotal: stayRoomSubtotal } = stay;
  const avgNightlyRate = nights > 0 ? subtotal / nights : Number(room.price_per_night);

  let islandHopping = Boolean(islandHoppingFlag);
  let islandHoppingAmount = 0;
  let islandHoppingStored = null;

  if (islandHopping) {
    const { validateIslandHoppingPayload, calculateIslandHopping } = await import('./islandHopping.js');
    const validation = validateIslandHoppingPayload(islandHoppingData);
    if (!validation.valid) return { error: validation.message };
    try {
      const computed = calculateIslandHopping(islandHoppingData.passengers);
      if (computed.error) return { error: computed.error };
      islandHoppingAmount = computed.total;
      islandHoppingStored = {
        passengers: islandHoppingData.passengers,
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
      bringing_car: bringingCarFlag,
      car_count: carCountBody,
      pet_count: petCountBody,
      bilao_enabled: bilaoEnabledFlag,
      bilao_package: bilaoPackageBody,
      boodle_fight_enabled: boodleFightEnabledFlag,
      boodle_fight_tier: boodleFightTierBody,
    },
    room.room_type
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
      room_id,
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

  const { insertBookingRooms } = await import('./bookingRooms.js');
  await insertBookingRooms(pool, result.insertId, [
    {
      room_id,
      adults,
      children_under6: childrenUnder6,
      children_7_12: children712,
      guest_count,
      nights,
      room_rate: avgNightlyRate,
      room_subtotal: stayRoomSubtotal ?? subtotal - (extraPersonCharges || 0),
      extra_person_charges: extraPersonCharges || 0,
      subtotal,
      sort_order: 0,
    },
  ]);

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
    room_name: room.name,
    island_hopping: islandHopping ? 1 : 0,
    island_hopping_amount: islandHoppingAmount,
    bilao_amount: extrasValidation.bilao_amount,
    boodle_fight_amount: extrasValidation.boodle_fight_amount,
    payment_option,
  };

  let emailResult = { sent: false };
  if (send_confirmation_email && status === 'confirmed') {
    emailResult = await sendBookingConfirmation(bookingRow, { name: room.name });
  }

  return { booking: bookingRow, emailResult };
}
