import {
  getManualOnlyPaymentMethodName,
  isManualOnlyPaymentMethodId,
  resolveEditFormPaymentMethodId,
  stripManualPaymentFromNotes,
} from '../data/manualBookingPayment';
import { emptyIslandHoppingForm, parseIslandHoppingData } from '../data/islandHoppingRates';

export function bookingToEditState(booking) {
  const islandRaw = booking?.island_hopping
    ? parseIslandHoppingData(booking.island_hopping_data)
    : null;

  return {
    room_id: booking?.room_id ? String(booking.room_id) : '',
    check_in: booking?.check_in?.slice?.(0, 10) || '',
    check_out: booking?.check_out?.slice?.(0, 10) || '',
    adults: booking?.adults ?? 1,
    children_under6: booking?.children_under6 ?? 0,
    children_7_12: booking?.children_7_12 ?? 0,
    guest_name: booking?.guest_name || '',
    guest_email: booking?.guest_email || '',
    guest_phone: booking?.guest_phone || '',
    valid_id: booking?.valid_id || '',
    estimated_arrival: booking?.estimated_arrival || '',
    special_requests: booking?.special_requests || '',
    admin_notes: stripManualPaymentFromNotes(booking?.admin_notes || ''),
    payment_method_id: resolveEditFormPaymentMethodId(booking),
    payment_option: booking?.payment_option || 'deposit',
    custom_payment_amount:
      booking?.payment_option === 'custom' ? String(booking.amount_to_pay ?? '') : '',
    admin_discount_amount:
      booking?.discount_code || !(Number(booking?.discount_amount) > 0)
        ? ''
        : String(booking.discount_amount),
    admin_discount_note: booking?.discount_code ? '' : booking?.discount_note || '',
    bookingExtras: {
      bringing_car: Boolean(booking?.bringing_car),
      car_count: booking?.car_count || 1,
      pet_count: booking?.pet_count ?? 0,
      bilao_enabled: Boolean(booking?.bilao_package),
      bilao_package: booking?.bilao_package || '',
      boodle_fight_enabled: Boolean(booking?.boodle_fight),
      boodle_fight_tier: booking?.boodle_fight_tier || '',
    },
    islandHoppingEnabled: Boolean(booking?.island_hopping),
    islandHopping: islandRaw
      ? {
          passengers: (islandRaw.passengers || []).map((p) => ({
            full_name: p.full_name || '',
            age: p.age ?? '',
            gender: p.gender || '',
            is_first_timer:
              p.is_first_timer === true ? true : p.is_first_timer === false ? false : '',
            is_senior: Boolean(p.is_senior),
            is_pwd: p.is_pwd === true ? true : p.is_pwd === false ? false : '',
            senior_id_file: null,
            pwd_id_file: null,
            senior_id_url: p.senior_id_url || null,
            pwd_id_url: p.pwd_id_url || null,
          })),
          passenger_address: islandRaw.passenger_address || '',
          payor_name: islandRaw.payor_name || '',
          payor_address: islandRaw.payor_address || '',
          payor_phone: islandRaw.payor_phone || '',
          emergency_contact_name: islandRaw.emergency_contact_name || '',
          emergency_contact_phone: islandRaw.emergency_contact_phone || '',
        }
      : emptyIslandHoppingForm(),
  };
}

export function editStateToPayload(state) {
  const payload = {
    room_id: parseInt(state.room_id, 10),
    check_in: state.check_in,
    check_out: state.check_out,
    adults: parseInt(state.adults, 10) || 1,
    children_under6: parseInt(state.children_under6, 10) || 0,
    children_7_12: parseInt(state.children_7_12, 10) || 0,
    guest_name: state.guest_name.trim(),
    guest_email: state.guest_email.trim(),
    guest_phone: state.guest_phone.trim(),
    valid_id: state.valid_id.trim(),
    estimated_arrival: state.estimated_arrival.trim(),
    special_requests: state.special_requests.trim(),
    admin_notes: state.admin_notes.trim(),
    payment_method_id: isManualOnlyPaymentMethodId(state.payment_method_id)
      ? null
      : state.payment_method_id
        ? parseInt(state.payment_method_id, 10)
        : null,
    manual_payment_method: isManualOnlyPaymentMethodId(state.payment_method_id)
      ? getManualOnlyPaymentMethodName(state.payment_method_id)
      : null,
    payment_option: state.payment_option,
    admin_discount_amount: state.admin_discount_amount,
    admin_discount_note: state.admin_discount_note,
    bringing_car: state.bookingExtras.bringing_car,
    car_count: state.bookingExtras.bringing_car
      ? parseInt(state.bookingExtras.car_count, 10) || 1
      : 0,
    pet_count: parseInt(state.bookingExtras.pet_count, 10) || 0,
    bilao_enabled: state.bookingExtras.bilao_enabled,
    bilao_package: state.bookingExtras.bilao_enabled ? state.bookingExtras.bilao_package : null,
    boodle_fight_enabled: state.bookingExtras.boodle_fight_enabled,
    boodle_fight_tier: state.bookingExtras.boodle_fight_enabled
      ? state.bookingExtras.boodle_fight_tier
      : null,
    island_hopping: state.islandHoppingEnabled,
  };

  if (state.payment_option === 'custom') {
    payload.custom_payment_amount = parseFloat(state.custom_payment_amount);
  }

  if (state.islandHoppingEnabled) {
    payload.island_hopping_data = {
      passengers: state.islandHopping.passengers.map((p) => ({
        full_name: p.full_name.trim(),
        age: parseInt(p.age, 10),
        gender: p.gender,
        is_first_timer: p.is_first_timer,
        is_senior: Boolean(p.is_senior),
        is_pwd: Boolean(p.is_pwd),
      })),
      passenger_address: state.islandHopping.passenger_address,
      payor_name: state.islandHopping.payor_name,
      payor_address: state.islandHopping.payor_address,
      payor_phone: state.islandHopping.payor_phone,
      emergency_contact_name: state.islandHopping.emergency_contact_name,
      emergency_contact_phone: state.islandHopping.emergency_contact_phone,
    };
  }

  return payload;
}
