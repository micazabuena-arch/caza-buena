import { applyDiscount, calculateNights } from './booking.js';
import { calculateStayTotal } from './pricing.js';
import { getDepositPercent, resolveAmountToPay } from './paymentAmount.js';

function bookingAddonsTotal(booking) {
  const island = booking.island_hopping ? Number(booking.island_hopping_amount) || 0 : 0;
  const bilao = Number(booking.bilao_amount) || 0;
  const boodle = Number(booking.boodle_fight_amount) || 0;
  return island + bilao + boodle;
}

function summarizeBreakdown(breakdown) {
  const summary = {
    weekday: 0,
    weekend: 0,
    holiday: 0,
    weekday_total: 0,
    weekend_total: 0,
    holiday_total: 0,
  };
  for (const night of breakdown) {
    if (night.type === 'holiday') {
      summary.holiday += 1;
      summary.holiday_total += night.rate;
    } else if (night.type === 'weekend') {
      summary.weekend += 1;
      summary.weekend_total += night.rate;
    } else {
      summary.weekday += 1;
      summary.weekday_total += night.rate;
    }
  }
  return summary;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * Compare pricing for a rebook / date change.
 * Room rates follow weekday (Mon–Thu) and weekend (Fri–Sun) per night.
 */
export async function computeRebookPricing(pool, booking, options = {}) {
  const roomId = parseInt(options.roomId ?? booking.room_id, 10);
  const occupancy = options.occupancy || {
    adults: booking.adults ?? booking.guest_count ?? 1,
    childrenUnder6: booking.children_under6 || 0,
    children7_12: booking.children_7_12 || 0,
  };

  const oldCheckIn = String(booking.check_in).slice(0, 10);
  const oldCheckOut = String(booking.check_out).slice(0, 10);
  const newCheckIn = String(options.checkIn).slice(0, 10);
  const newCheckOut = String(options.checkOut).slice(0, 10);

  const oldNights = calculateNights(oldCheckIn, oldCheckOut);
  const newNights = calculateNights(newCheckIn, newCheckOut);
  if (newNights < 1) return { error: 'Check-out must be after check-in' };

  const oldStay = await calculateStayTotal(pool, booking.room_id, oldCheckIn, oldCheckOut, occupancy);
  const newStay = await calculateStayTotal(pool, roomId, newCheckIn, newCheckOut, occupancy);

  const oldDiscount = await applyDiscount(pool, booking.discount_code, oldNights, oldStay.subtotal);
  const newDiscount = await applyDiscount(pool, booking.discount_code, newNights, newStay.subtotal);
  if (booking.discount_code && newDiscount.error) {
    return { error: newDiscount.error };
  }

  const oldRoomTotal = Math.max(0, oldStay.subtotal - (oldDiscount.amount || 0));
  const newRoomTotal = Math.max(0, newStay.subtotal - (newDiscount.amount || 0));
  const addons = bookingAddonsTotal(booking);

  const previousTotal = roundMoney(oldRoomTotal + addons);
  const newTotal = roundMoney(newRoomTotal + addons);
  const difference = roundMoney(newTotal - previousTotal);

  const [settingRows] = await pool.query(
    "SELECT setting_value FROM site_settings WHERE setting_key = 'booking_deposit_percent'"
  );
  const depositPercent = getDepositPercent(settingRows[0]?.setting_value);
  const customAmount =
    booking.payment_option === 'custom' ? Number(booking.amount_to_pay) : undefined;
  const oldPay = resolveAmountToPay(previousTotal, booking.payment_option, customAmount, depositPercent);
  const newPay = resolveAmountToPay(newTotal, booking.payment_option, customAmount, depositPercent);
  if (newPay.error) return { error: newPay.error };

  const payDifference = roundMoney(newPay.amount - oldPay.amount);

  let adjustmentType = 'unchanged';
  if (difference > 0) adjustmentType = 'additional_charge';
  else if (difference < 0) adjustmentType = 'refund';

  return {
    previous_check_in: oldCheckIn,
    previous_check_out: oldCheckOut,
    new_check_in: newCheckIn,
    new_check_out: newCheckOut,
    previous_nights: oldNights,
    new_nights: newNights,
    previous_room_total: roundMoney(oldRoomTotal),
    new_room_total: roundMoney(newRoomTotal),
    addons_total: roundMoney(addons),
    previous_total_amount: previousTotal,
    new_total_amount: newTotal,
    price_difference: difference,
    adjustment_type: adjustmentType,
    adjustment_amount: roundMoney(Math.abs(difference)),
    previous_amount_to_pay: oldPay.amount,
    new_amount_to_pay: newPay.amount,
    amount_to_pay_difference: payDifference,
    previous_breakdown_summary: summarizeBreakdown(oldStay.breakdown),
    new_breakdown_summary: summarizeBreakdown(newStay.breakdown),
    new_breakdown: newStay.breakdown,
    rate_note: 'Room rates follow weekday (Mon–Thu) and weekend (Fri–Sun) pricing for each night.',
  };
}
