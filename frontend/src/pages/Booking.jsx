import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import api, { getApiError } from '../api/client';
import PageHero from '../components/ui/PageHero';
import PaymentWorkflowSteps from '../components/booking/PaymentWorkflowSteps';
import PaymentMethodSelect from '../components/booking/PaymentMethodSelect';
import PaymentAmountSelect from '../components/booking/PaymentAmountSelect';
import IslandHoppingSection from '../components/booking/IslandHoppingSection';
import BookingExtrasSection from '../components/booking/BookingExtrasSection';
import FormSection from '../components/booking/FormSection';
import { CardSkeleton } from '../components/ui/ContentSkeleton';
import SubmitButton from '../components/ui/SubmitButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { pages, images } from '../data/placeholders';
import { EXTRA_PERSON_RATES, ROOM_INVENTORY } from '../data/resortRules';
import {
  formatExtraChildrenLabel,
  getExtraAdultsLines,
} from '../utils/extraGuestLabels';
import {
  calculateIslandHopping,
  emptyIslandHoppingForm,
  emptyPassenger,
  isSeniorPassenger,
  isPwdPassenger,
} from '../data/islandHoppingRates';
import {
  emptyBookingExtras,
  getBilaoPackage,
  getBoodlePackage,
  validateBookingExtras,
} from '../data/bookingAddOns';
import { getStayDateError, minCheckOutDate, minCheckInDate } from '../utils/stayDates';
import { digitsOnly } from '../utils/inputSanitizers';

function capacityNoteForRoom(room) {
  if (!room) return null;
  const type = room.room_type === 'suite' ? 'suite' : 'queen';
  return ROOM_INVENTORY[type]?.capacityNote;
}

export default function Booking() {
  const { booking: meta } = pages;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedRoom = searchParams.get('room');
  const paramCheckIn = searchParams.get('check_in');
  const paramCheckOut = searchParams.get('check_out');
  const paramGuests = searchParams.get('guests');
  const roomLocked = Boolean(preselectedRoom);

  const [rooms, setRooms] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const [availability, setAvailability] = useState(null);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [error, setError] = useState('');
  const [depositPercent, setDepositPercent] = useState(20);
  const [islandHoppingEnabled, setIslandHoppingEnabled] = useState(false);
  const [islandHopping, setIslandHopping] = useState(emptyIslandHoppingForm);
  const [bookingExtras, setBookingExtras] = useState(emptyBookingExtras);
  const [form, setForm] = useState({
    room_id: preselectedRoom || '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    valid_id: '',
    estimated_arrival: '',
    adults: paramGuests ? parseInt(paramGuests, 10) : 2,
    children_under6: 0,
    children_7_12: 0,
    check_in: paramCheckIn || format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    check_out: paramCheckOut || format(addDays(new Date(), 2), 'yyyy-MM-dd'),
    special_requests: '',
    payment_method_id: '',
    payment_option: 'deposit',
    custom_payment_amount: '',
  });

  useEffect(() => {
    Promise.all([api.get('/rooms'), api.get('/payment-methods'), api.get('/settings/public')])
      .then(([roomsRes, payRes, settingsRes]) => {
        setRooms(roomsRes.data);
        setPaymentMethods(payRes.data);
        if (settingsRes.data?.booking_deposit_percent) {
          setDepositPercent(settingsRes.data.booking_deposit_percent);
        }
        if (preselectedRoom) setForm((f) => ({ ...f, room_id: preselectedRoom }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [preselectedRoom]);

  const dateError = useMemo(
    () => getStayDateError(form.check_in, form.check_out),
    [form.check_in, form.check_out]
  );

  useEffect(() => {
    if (!form.room_id || !form.check_in || !form.check_out || dateError) {
      setAvailability(null);
      setAvailabilityChecking(false);
      return;
    }
    setAvailabilityChecking(true);
    api
      .get('/bookings/availability', {
        params: {
          room_id: form.room_id,
          check_in: form.check_in,
          check_out: form.check_out,
          adults: form.adults,
          children_under6: form.children_under6,
          children_7_12: form.children_7_12,
        },
      })
      .then((r) => setAvailability(r.data))
      .catch(() => setAvailability(null))
      .finally(() => setAvailabilityChecking(false));
  }, [
    form.room_id,
    form.check_in,
    form.check_out,
    form.adults,
    form.children_under6,
    form.children_7_12,
    dateError,
  ]);

  const guestCount =
    (parseInt(form.adults, 10) || 0) +
    (parseInt(form.children_under6, 10) || 0) +
    (parseInt(form.children_7_12, 10) || 0);
  const selectedRoom = rooms.find((r) => String(r.id) === String(form.room_id));

  useEffect(() => {
    if (!form.room_id) return;
    const room = rooms.find((r) => String(r.id) === String(form.room_id));
    const roomMax = room?.max_guests ?? room?.capacity ?? 1;
    if (room && roomMax < guestCount && !roomLocked) {
      setForm((f) => ({ ...f, room_id: '' }));
      setAvailability(null);
    }
  }, [form.adults, form.children_under6, form.children_7_12, form.room_id, rooms, guestCount, roomLocked]);

  const roomsSearchUrl = () => {
    const params = new URLSearchParams();
    if (form.check_in) params.set('check_in', form.check_in);
    if (form.check_out) params.set('check_out', form.check_out);
    params.set('guests', String(Math.max(1, guestCount)));
    return `/rooms?${params.toString()}`;
  };

  const roomTypeLabel =
    selectedRoom?.room_type === 'suite'
      ? ROOM_INVENTORY.suite.label
      : selectedRoom?.room_type === 'queen'
        ? ROOM_INVENTORY.queen.label
        : null;
  const nights = availability?.nights || 0;
  const subtotal =
    availability?.available && availability.subtotal != null
      ? Number(availability.subtotal)
      : 0;
  const priceBreakdown = availability?.breakdown || [];
  const roomTotal = subtotal;
  const extraCharges = availability?.extra_person_charges || 0;
  const roomSubtotal = availability?.room_subtotal ?? subtotal;

  const islandQuote =
    islandHoppingEnabled && islandHopping.passengers?.length
      ? calculateIslandHopping(islandHopping.passengers)
      : null;
  const islandHoppingTotal =
    islandHoppingEnabled && islandQuote && !islandQuote.error && islandQuote.complete
      ? islandQuote.total
      : 0;
  const extrasQuote = selectedRoom
    ? validateBookingExtras(bookingExtras, selectedRoom.room_type)
    : null;
  const bilaoTotal = extrasQuote?.valid ? extrasQuote.bilao_amount : 0;
  const boodleTotal = extrasQuote?.valid ? extrasQuote.boodle_fight_amount : 0;
  const petDeposit = extrasQuote?.valid ? extrasQuote.pet_deposit_amount : 0;
  const addOnsTotal = bilaoTotal + boodleTotal;
  const totalAmount = roomTotal + islandHoppingTotal + addOnsTotal;

  const depositAmount = Math.round(((totalAmount * depositPercent) / 100) * 100) / 100;
  const customPay = parseFloat(form.custom_payment_amount);
  const amountToPay =
    form.payment_option === 'full'
      ? totalAmount
      : form.payment_option === 'deposit'
        ? depositAmount
        : Number.isFinite(customPay)
          ? customPay
          : 0;

  const submitBlockedReason = useMemo(() => {
    if (dateError) return dateError;
    if (!form.room_id) {
      return roomLocked
        ? 'Room not found. Go back and select a room again.'
        : 'Select a room before submitting.';
    }
    if (availabilityChecking) return 'Checking availability for your dates…';
    if (!availability) {
      return 'Could not verify availability. Check that the backend is running and your dates are valid.';
    }
    if (availability.occupancy_error) return availability.occupancy_error;
    if (!availability.available) {
      return 'These dates are not available for this room. Change check-in or check-out dates.';
    }
    if (selectedRoom) {
      const maxG = selectedRoom.max_guests ?? selectedRoom.capacity ?? 1;
      const minG = selectedRoom.min_guests ?? 1;
      if (guestCount > maxG) {
        return `This room allows up to ${maxG} guests. Lower guest count or choose another room.`;
      }
      if (guestCount < minG) {
        return `This room requires at least ${minG} guest(s).`;
      }
    }
    if (totalAmount <= 0) {
      return 'Booking total could not be calculated. Check that check-out is after check-in.';
    }
    if (paymentMethods.length > 0 && !form.payment_method_id) {
      return 'Select a preferred payment method (GCash, Maya, etc.).';
    }
    if (!form.valid_id?.trim()) {
      return 'Enter a valid ID type and number for the lead guest.';
    }
    if (form.payment_option === 'custom') {
      if (!Number.isFinite(customPay) || customPay <= 0) {
        return 'Enter a valid custom payment amount.';
      }
      if (customPay > totalAmount) {
        return 'Custom payment amount cannot exceed the booking total.';
      }
    }
    if (islandHoppingEnabled) {
      if (islandQuote?.error) return islandQuote.error;
      if (!islandQuote?.complete) {
        return 'Complete all island hopping passenger details, or choose No for island hopping.';
      }
      if (!islandHopping.passenger_address?.trim()) {
        return 'Enter the address of passengers for island hopping.';
      }
      if (
        !islandHopping.payor_name?.trim() ||
        !islandHopping.payor_address?.trim() ||
        !islandHopping.payor_phone?.trim()
      ) {
        return 'Complete payor name, address, and phone for island hopping.';
      }
      if (
        !islandHopping.emergency_contact_name?.trim() ||
        !islandHopping.emergency_contact_phone?.trim()
      ) {
        return 'Complete emergency contact details for island hopping.';
      }
      const missingSeniorId = islandHopping.passengers.some(
        (p) => isSeniorPassenger(p) && !p.senior_id_file
      );
      if (missingSeniorId) {
        return 'Upload a senior citizen ID for each guest aged 60 or older on the tour.';
      }
      const missingPwdId = islandHopping.passengers.some(
        (p) => isPwdPassenger(p) && !p.pwd_id_file
      );
      if (missingPwdId) {
        return 'Upload a PWD ID for each guest marked as PWD on the tour.';
      }
    }
    if (extrasQuote && !extrasQuote.valid) return extrasQuote.message;
    return null;
  }, [
    form.room_id,
    dateError,
    form.payment_method_id,
    form.valid_id,
    form.payment_option,
    availabilityChecking,
    availability,
    selectedRoom,
    guestCount,
    totalAmount,
    paymentMethods.length,
    customPay,
    islandHoppingEnabled,
    islandQuote,
    islandHopping,
    roomLocked,
    extrasQuote,
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const numeric = ['adults', 'children_under6', 'children_7_12'];
    const nextValue = name === 'guest_phone' ? digitsOnly(value) : value;
    const next = {
      ...form,
      [name]: numeric.includes(name) ? (nextValue === '' ? '' : parseInt(nextValue, 10)) : nextValue,
    };

    if (name === 'check_in' && value) {
      const earliestOut = minCheckOutDate(value);
      if (earliestOut && next.check_out && next.check_out <= value) {
        next.check_out = earliestOut;
      }
    }

    setForm(next);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dateError) {
      setError(dateError);
      return;
    }
    if (!form.room_id) {
      setError('Please select a room from the available rooms list first.');
      return;
    }
    const maxG = selectedRoom.max_guests ?? selectedRoom.capacity ?? 1;
    const minG = selectedRoom.min_guests ?? 1;
    if (selectedRoom && guestCount > maxG) {
      setError(`This room allows up to ${maxG} guests. Adjust guest count or choose another room.`);
      return;
    }
    if (selectedRoom && guestCount < minG) {
      setError(`This room requires at least ${minG} guest(s).`);
      return;
    }
    if (availability?.occupancy_error) {
      setError(availability.occupancy_error);
      return;
    }
    if (!availability?.available) {
      setError('Selected dates are not available. Please choose different dates.');
      return;
    }
    if (!form.valid_id?.trim()) {
      setError('Please enter a valid ID type and number for the lead guest.');
      return;
    }
    if (form.payment_option === 'custom') {
      if (!Number.isFinite(customPay) || customPay <= 0) {
        setError('Enter a valid custom payment amount.');
        return;
      }
      if (customPay > totalAmount) {
        setError('Custom amount cannot exceed the booking total.');
        return;
      }
    }
    if (islandHoppingEnabled) {
      if (!islandQuote?.complete) {
        setError('Please complete all island hopping fields.');
        return;
      }
      if (!islandHopping.passenger_address?.trim()) {
        setError('Address of passengers is required for island hopping.');
        return;
      }
      if (!islandHopping.payor_name?.trim() || !islandHopping.payor_address?.trim() || !islandHopping.payor_phone?.trim()) {
        setError('Payor name, address, and cellphone are required for island hopping.');
        return;
      }
      if (!islandHopping.emergency_contact_name?.trim() || !islandHopping.emergency_contact_phone?.trim()) {
        setError('Emergency contact name and cellphone are required for island hopping.');
        return;
      }
      const missingSeniorId = islandHopping.passengers.some(
        (p) => isSeniorPassenger(p) && !p.senior_id_file
      );
      if (missingSeniorId) {
        setError('Please upload a senior citizen ID for each guest aged 60 or older.');
        return;
      }
      const missingPwdId = islandHopping.passengers.some(
        (p) => isPwdPassenger(p) && !p.pwd_id_file
      );
      if (missingPwdId) {
        setError('Please upload a PWD ID for each guest marked as PWD.');
        return;
      }
    }
    if (extrasQuote && !extrasQuote.valid) {
      setError(extrasQuote.message);
      return;
    }
    const ok = await confirm({
      title: 'Submit booking?',
      message: 'Please confirm your reservation details. You will receive payment instructions after submitting.',
      confirmLabel: 'Yes, submit booking',
    });
    if (!ok) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/bookings', {
        room_id: parseInt(form.room_id, 10),
        guest_name: form.guest_name,
        guest_email: form.guest_email,
        guest_phone: form.guest_phone,
        valid_id: form.valid_id.trim(),
        estimated_arrival: form.estimated_arrival.trim() || null,
        adults: parseInt(form.adults, 10) || 1,
        children_under6: parseInt(form.children_under6, 10) || 0,
        children_7_12: parseInt(form.children_7_12, 10) || 0,
        guest_count: guestCount,
        check_in: form.check_in,
        check_out: form.check_out,
        special_requests: form.special_requests,
        payment_method_id: form.payment_method_id ? parseInt(form.payment_method_id, 10) : null,
        payment_option: form.payment_option,
        custom_payment_amount:
          form.payment_option === 'custom' ? customPay : undefined,
        island_hopping: islandHoppingEnabled,
        island_hopping_data: islandHoppingEnabled
          ? {
              passengers: islandHopping.passengers.map((p) => ({
                full_name: p.full_name.trim(),
                age: parseInt(p.age, 10),
                gender: p.gender,
                is_first_timer: p.is_first_timer,
                is_senior: Boolean(p.is_senior),
                is_pwd: Boolean(p.is_pwd),
              })),
              passenger_address: islandHopping.passenger_address,
              payor_name: islandHopping.payor_name,
              payor_address: islandHopping.payor_address,
              payor_phone: islandHopping.payor_phone,
              emergency_contact_name: islandHopping.emergency_contact_name,
              emergency_contact_phone: islandHopping.emergency_contact_phone,
            }
          : undefined,
        bringing_car: bookingExtras.bringing_car,
        car_count: bookingExtras.bringing_car ? parseInt(bookingExtras.car_count, 10) || 1 : 0,
        pet_count: parseInt(bookingExtras.pet_count, 10) || 0,
        bilao_enabled: bookingExtras.bilao_enabled,
        bilao_package: bookingExtras.bilao_enabled ? bookingExtras.bilao_package : undefined,
        boodle_fight_enabled: bookingExtras.boodle_fight_enabled,
        boodle_fight_tier: bookingExtras.boodle_fight_enabled
          ? bookingExtras.boodle_fight_tier
          : undefined,
      });
      const reference = data?.booking?.reference_code;
      if (!reference) {
        throw new Error('Booking was created but the confirmation link is missing. Check Admin → Bookings.');
      }

      if (islandHoppingEnabled) {
        const seniorUploads = islandHopping.passengers
          .map((p, index) => ({ p, index }))
          .filter(({ p }) => isSeniorPassenger(p) && p.senior_id_file);
        const pwdUploads = islandHopping.passengers
          .map((p, index) => ({ p, index }))
          .filter(({ p }) => isPwdPassenger(p) && p.pwd_id_file);

        let uploadFailed = false;
        for (const { p, index } of seniorUploads) {
          try {
            const formData = new FormData();
            formData.append('id', p.senior_id_file);
            formData.append('passenger_index', String(index));
            await api.post(`/bookings/${reference}/senior-id`, formData);
          } catch {
            uploadFailed = true;
          }
        }
        for (const { p, index } of pwdUploads) {
          try {
            const formData = new FormData();
            formData.append('id', p.pwd_id_file);
            formData.append('passenger_index', String(index));
            await api.post(`/bookings/${reference}/pwd-id`, formData);
          } catch {
            uploadFailed = true;
          }
        }
        if (uploadFailed) {
          toast.warning(
            'Booking saved. Some ID uploads failed — you can upload them on the confirmation page.'
          );
        }
      }

      toast.success(
        'Booking request submitted! Complete payment and upload proof on the next page.'
      );
      navigate(`/booking/confirm/${reference}`);
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHero {...meta} image={images.pageHero} imagePosition={images.pageHeroObjectPosition} />
      <section className="section-padding">
        <div className="container-narrow max-w-4xl">
          <div className="mb-10">
            <h2 className="text-lg font-serif text-aegean-800 mb-4">How booking works</h2>
            <PaymentWorkflowSteps currentStep={1} />
          </div>
          {loading ? (
            <CardSkeleton count={1} />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-aegean-100">
                <h2 className="text-xl font-serif text-aegean-800">Reservation request</h2>
                <p className="text-sm text-aegean-600 mt-1">
                  Complete each section below. Your total updates as you add optional items.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                  {error}
                </div>
              )}
              {rooms.length === 0 && (
                <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-100">
                  No rooms available from API. Start the backend and ensure rooms are active in Admin.
                </div>
              )}
              {!roomLocked && (
                <div className="p-4 bg-aegean-50 text-aegean-800 rounded-lg text-sm text-center border border-aegean-100">
                  <p className="mb-3">Choose an available room for your dates before completing this form.</p>
                  <Link to={roomsSearchUrl()} className="btn-primary text-sm inline-block">
                    View available rooms
                  </Link>
                </div>
              )}

              <FormSection
                step={1}
                title="Your stay"
                description="Room, dates, and number of guests"
              >
              {roomLocked && selectedRoom && (
                <div className="rounded-xl border border-aegean-200 bg-aegean-50/60 overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    {selectedRoom.images?.[0]?.image_url && (
                      <div className="sm:w-40 h-36 sm:h-auto shrink-0">
                        <img
                          src={selectedRoom.images[0].image_url}
                          alt={selectedRoom.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-5 flex-1">
                      <p className="text-xs uppercase tracking-wider text-aegean-500 mb-1">Your room</p>
                      <h3 className="text-xl font-serif text-aegean-800">{selectedRoom.name}</h3>
                      {roomTypeLabel && (
                        <p className="text-sm text-aegean-600 mt-0.5">{roomTypeLabel}</p>
                      )}
                      {capacityNoteForRoom(selectedRoom) && (
                        <p className="text-sm text-aegean-600 mt-1">{capacityNoteForRoom(selectedRoom)}</p>
                      )}
                      {guestCount > (selectedRoom.max_guests ?? selectedRoom.capacity ?? 1) && (
                        <p className="text-sm text-red-600 mt-2">
                          Too many guests for this room. Lower guest count or{' '}
                          <Link to={roomsSearchUrl()} className="underline">
                            pick another room
                          </Link>
                          .
                        </p>
                      )}
                      <Link
                        to={roomsSearchUrl()}
                        className="inline-block text-sm text-aegean-500 hover:text-aegean-700 mt-3 underline"
                      >
                        Change room
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {roomLocked && !loading && !selectedRoom && (
                <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm">
                  Room not found.{' '}
                  <Link to={roomsSearchUrl()} className="underline font-medium">
                    Select a room again
                  </Link>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-aegean-700 mb-3">Check-in & check-out</p>
                <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-aegean-700 mb-1">Check-in *</label>
                  <input
                    type="date"
                    name="check_in"
                    min={minCheckInDate()}
                    value={form.check_in}
                    onChange={handleChange}
                    required
                    className={`w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none ${
                      dateError ? 'border-red-400' : 'border-aegean-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-aegean-700 mb-1">Check-out *</label>
                  <input
                    type="date"
                    name="check_out"
                    value={form.check_out}
                    onChange={handleChange}
                    min={minCheckOutDate(form.check_in) || minCheckInDate()}
                    required
                    className={`w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none ${
                      dateError ? 'border-red-400' : 'border-aegean-200'
                    }`}
                  />
                </div>
                </div>
                {dateError && (
                  <p className="text-sm text-red-600 mt-2" role="alert">
                    {dateError}
                  </p>
                )}
              </div>

              {availability && !availability.available && !availability.occupancy_error && (
                <p className="text-sm text-red-600">Not available for selected dates</p>
              )}

              <div>
                <p className="text-sm font-medium text-aegean-700 mb-3">Guests</p>
              {capacityNoteForRoom(selectedRoom) && (
                <p className="text-xs text-aegean-600 mb-2">
                  <span className="font-medium">Maximum: </span>
                  {capacityNoteForRoom(selectedRoom)}
                </p>
              )}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-aegean-700 mb-1">Adults *</label>
                  <input
                    type="number"
                    name="adults"
                    min={1}
                    value={form.adults}
                    onChange={handleChange}
                    required
                    className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-aegean-700 mb-1">
                    Children (6 & below)
                  </label>
                  <input
                    type="number"
                    name="children_under6"
                    min={0}
                    value={form.children_under6}
                    onChange={handleChange}
                    className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
                  />
                  <p className="text-xs text-aegean-500 mt-1">Free</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-aegean-700 mb-1">
                    Children (7–12)
                  </label>
                  <input
                    type="number"
                    name="children_7_12"
                    min={0}
                    value={form.children_7_12}
                    onChange={handleChange}
                    className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
                  />
                  <p className="text-xs text-aegean-500 mt-1">₱{EXTRA_PERSON_RATES.child_7_12}/night each</p>
                </div>
              </div>
                <p className="text-xs text-aegean-500 mt-3">
                  {availability?.extra_breakdown?.packageLabel ? (
                    <>Package: {availability.extra_breakdown.packageLabel}. </>
                  ) : null}
                  Extra adult ₱{EXTRA_PERSON_RATES.adult_weekday}/night (Mon–Thu) or ₱{EXTRA_PERSON_RATES.adult_weekend}/night (Fri–Sun) above included adults · child 7–12
                  ₱{EXTRA_PERSON_RATES.child_7_12}/night · child 6 & below free.
                </p>
              </div>

              {availability?.occupancy_error && (
                <p className="text-sm text-red-600">{availability.occupancy_error}</p>
              )}
              </FormSection>

              <FormSection
                step={2}
                title="Guest details"
                description="Lead guest contact information"
              >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-aegean-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="guest_name"
                    value={form.guest_name}
                    onChange={handleChange}
                    required
                    className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-aegean-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    name="guest_phone"
                    value={form.guest_phone}
                    onChange={handleChange}
                  inputMode="numeric"
                  pattern="[0-9]*"
                    required
                    className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="guest_email"
                  value={form.guest_email}
                  onChange={handleChange}
                  required
                  className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">
                  Valid ID (type & number) *
                </label>
                <input
                  type="text"
                  name="valid_id"
                  value={form.valid_id}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Driver's License — N01-12-345678"
                  className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">
                  Estimated time of arrival
                </label>
                <input
                  type="text"
                  name="estimated_arrival"
                  value={form.estimated_arrival}
                  onChange={handleChange}
                  placeholder="e.g. 2:00 PM, after Hundred Islands tour"
                  className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
                />
              </div>
              </FormSection>

              <FormSection
                step={3}
                title="Add-ons"
                description="Parking, pets, food packages, and island hopping — all optional"
              >
                <BookingExtrasSection
                  data={bookingExtras}
                  onChange={setBookingExtras}
                  roomType={selectedRoom?.room_type === 'suite' ? 'suite' : 'queen'}
                />
                <IslandHoppingSection
                  embedded
                  enabled={islandHoppingEnabled}
                  onEnabledChange={(yes) => {
                    setIslandHoppingEnabled(yes);
                    if (yes && islandHopping.passengers.length < guestCount) {
                      const passengers = [...islandHopping.passengers];
                      while (passengers.length < Math.min(guestCount, 20)) {
                        passengers.push(emptyPassenger());
                      }
                      setIslandHopping((d) => ({ ...d, passengers }));
                    }
                  }}
                  data={islandHopping}
                  onChange={setIslandHopping}
                />
              </FormSection>

              {availability?.available && totalAmount > 0 && (
              <FormSection
                step={4}
                title="Review & payment"
                description="Check your total, then choose how much to pay now"
              >
                <div className="rounded-xl border border-aegean-200 bg-aegean-50/40 p-4 text-sm space-y-3">
                  <p className="font-serif text-aegean-800 font-medium">Price summary</p>

                  <div className="space-y-1 text-aegean-700">
                    <div className="flex justify-between">
                      <span>Room rate ({nights} night{nights !== 1 ? 's' : ''})</span>
                      <span>₱{Number(roomSubtotal).toLocaleString()}</span>
                    </div>
                    {priceBreakdown.length > 0 && (
                      <ul className="text-xs text-aegean-500 pl-2 space-y-0.5">
                        {priceBreakdown.map((n) => (
                          <li key={n.date}>
                            {n.date}: ₱{Number(n.rate).toLocaleString()}
                            {n.type === 'holiday' && n.label ? ` (${n.label})` : ` (${n.type})`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border-t border-aegean-200 pt-3 space-y-1">
                    <p className="font-medium text-aegean-800">Additional guests</p>
                    {availability.extra_breakdown ? (
                      extraCharges > 0 ? (
                        <>
                          <p className="text-xs text-aegean-600">
                            Room rate includes {availability.extra_breakdown.includedAdults}{' '}
                            adult(s) for this package.
                          </p>
                          {getExtraAdultsLines(availability.extra_breakdown).map((line) => (
                            <div
                              key={line.label}
                              className="flex justify-between text-aegean-700 gap-4"
                            >
                              <span>{line.label}</span>
                              <span className="shrink-0">₱{Number(line.amount).toLocaleString()}</span>
                            </div>
                          ))}
                          {availability.extra_breakdown.extraChildren7_12 > 0 && (
                            <div className="flex justify-between text-aegean-700 gap-4">
                              <span>{formatExtraChildrenLabel(availability.extra_breakdown)}</span>
                              <span className="shrink-0">
                                ₱{Number(availability.extra_breakdown.childChargeTotal || 0).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between font-medium pt-1">
                            <span>Additional total</span>
                            <span>₱{Number(extraCharges).toLocaleString()}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-aegean-600">
                          {availability.extra_breakdown.note || 'No additional guest fees.'}
                        </p>
                      )
                    ) : (
                      <p className="text-xs text-aegean-500">Enter guests to see pricing.</p>
                    )}
                  </div>

                  {(islandHoppingTotal > 0 || bilaoTotal > 0 || boodleTotal > 0) && (
                    <div className="border-t border-aegean-200 pt-3 space-y-1">
                      <p className="font-medium text-aegean-800">Add-ons</p>
                      {islandHoppingTotal > 0 && (
                        <div className="flex justify-between text-aegean-700">
                          <span>Island hopping</span>
                          <span>₱{islandHoppingTotal.toLocaleString()}</span>
                        </div>
                      )}
                      {bilaoTotal > 0 && (
                        <div className="flex justify-between text-aegean-700">
                          <span>
                            Bilao ({getBilaoPackage(bookingExtras.bilao_package)?.label || 'selected'})
                          </span>
                          <span>₱{bilaoTotal.toLocaleString()}</span>
                        </div>
                      )}
                      {boodleTotal > 0 && (
                        <div className="flex justify-between text-aegean-700">
                          <span>
                            Boodle fight (
                            {getBoodlePackage(bookingExtras.boodle_fight_tier)?.label || 'selected'})
                          </span>
                          <span>₱{boodleTotal.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {petDeposit > 0 && (
                    <div className="flex justify-between text-aegean-600 text-xs border-t border-aegean-200 pt-2">
                      <span>Pet deposit (refundable, payable on arrival)</span>
                      <span>₱{petDeposit.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-aegean-300 pt-3 text-base font-semibold text-aegean-800">
                    <span>Grand total</span>
                    <span>₱{totalAmount.toLocaleString()}</span>
                  </div>
                  {islandHoppingEnabled && !islandHoppingTotal && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Complete island hopping details in section 3 to include tour fees in your total.
                    </p>
                  )}
                  {bookingExtras.bilao_enabled && !bilaoTotal && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Select a Bilao package size in section 3 to include it in your total.
                    </p>
                  )}
                  {bookingExtras.boodle_fight_enabled && !boodleTotal && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Select a Boodle fight group size in section 3 to include it in your total.
                    </p>
                  )}
                </div>

                <PaymentAmountSelect
                  totalAmount={totalAmount}
                  depositPercent={depositPercent}
                  paymentOption={form.payment_option}
                  customAmount={form.custom_payment_amount}
                  onOptionChange={(id) => setForm((f) => ({ ...f, payment_option: id }))}
                  onCustomAmountChange={(val) =>
                    setForm((f) => ({ ...f, custom_payment_amount: val }))
                  }
                />

              {paymentMethods.length > 0 && (
                <PaymentMethodSelect
                  methods={paymentMethods}
                  value={form.payment_method_id}
                  onChange={(id) => setForm((f) => ({ ...f, payment_method_id: id }))}
                  amountDue={amountToPay > 0 ? amountToPay : null}
                  required
                />
              )}

              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">
                  Special requests
                </label>
                <textarea
                  name="special_requests"
                  value={form.special_requests}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Early check-in, dietary needs, celebration setup..."
                  className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
                />
              </div>

              {submitBlockedReason && !submitting && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  {submitBlockedReason}
                </p>
              )}

              <SubmitButton
                loading={submitting}
                loadingLabel="Submitting..."
                className="w-full"
                disabled={Boolean(submitBlockedReason) || availabilityChecking}
              >
                Submit Booking Request
              </SubmitButton>
              </FormSection>
              )}
            </form>
          )}
        </div>
      </section>
    </>
  );
}
