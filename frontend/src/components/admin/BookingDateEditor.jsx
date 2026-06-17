import { useEffect, useMemo, useState } from 'react';

import { CalendarRange } from 'lucide-react';

import api, { getApiError } from '../../api/client';

import SubmitButton from '../ui/SubmitButton';

import { useToast } from '../../context/ToastContext';

import { useConfirm } from '../../context/ConfirmContext';

import RebookPricePreview, {

  rebookConfirmMessage,

  rebookSuccessMessage,

} from './RebookPricePreview';
import StayDateRangeCalendar from '../booking/StayDateRangeCalendar';
import useRoomCalendar, {
  isCheckInNightAvailable,
  isStayRangeAvailable,
} from '../../hooks/useRoomCalendar';
import { isPastStayDate, minCheckInDate, minCheckOutDate } from '../../utils/stayDates';



const EDITABLE_STATUSES = new Set([

  'cancelled',

  'rejected',

  'pending',

  'awaiting_payment',

  'payment_submitted',

  'confirmed',

]);



export function canEditBookingDates(status) {

  return EDITABLE_STATUSES.has(status);

}



export default function BookingDateEditor({ booking, onSaved, className = '', inline = false }) {

  const toast = useToast();

  const confirm = useConfirm();

  const [editing, setEditing] = useState(inline);

  const [checkIn, setCheckIn] = useState(booking.check_in?.slice(0, 10) || '');

  const [checkOut, setCheckOut] = useState(booking.check_out?.slice(0, 10) || '');

  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState('');

  const [quote, setQuote] = useState(null);

  const [quoteLoading, setQuoteLoading] = useState(false);



  useEffect(() => {

    setCheckIn(booking.check_in?.slice(0, 10) || '');

    setCheckOut(booking.check_out?.slice(0, 10) || '');
    setDateError('');

    setEditing(inline);

  }, [booking.id, booking.check_in, booking.check_out, inline]);



  const datesChanged =

    checkIn !== (booking.check_in?.slice(0, 10) || '') ||

    checkOut !== (booking.check_out?.slice(0, 10) || '');

  const calendarViewMonth = useMemo(() => {
    const base = checkIn ? new Date(`${checkIn}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [checkIn]);
  const { dayRates } = useRoomCalendar(booking.room_id, calendarViewMonth);



  useEffect(() => {

    if (!editing || !checkIn || !checkOut || !datesChanged) {

      setQuote(null);

      return;

    }



    setQuoteLoading(true);

    const timer = setTimeout(() => {

      api

        .get(`/bookings/admin/${booking.id}/rebook-quote`, {

          params: { check_in: checkIn, check_out: checkOut },

        })

        .then((r) => setQuote(r.data))

        .catch((err) => setQuote({ error: getApiError(err) }))

        .finally(() => setQuoteLoading(false));

    }, 300);



    return () => clearTimeout(timer);

  }, [booking.id, checkIn, checkOut, editing, datesChanged]);



  if (!canEditBookingDates(booking.status)) {

    return null;

  }



  const cancelEdit = () => {

    setCheckIn(booking.check_in?.slice(0, 10) || '');

    setCheckOut(booking.check_out?.slice(0, 10) || '');

    setQuote(null);
    setDateError('');

    setEditing(false);

  };

  const handleCheckInChange = (value) => {
    if (isPastStayDate(value)) {
      setDateError('Check-in cannot be in the past.');
      return;
    }
    if (!isCheckInNightAvailable(value, dayRates)) {
      setDateError('This check-in night is already booked or blocked.');
      return;
    }
    const earliest = minCheckOutDate(value);
    setCheckIn(value);
    if (earliest && checkOut && checkOut <= value) {
      setCheckOut(earliest);
    }
    setDateError('');
  };

  const handleCheckOutChange = (value) => {
    if (!isStayRangeAvailable(checkIn, value, dayRates)) {
      setDateError('Some nights in this range are already booked or blocked.');
      return;
    }
    setCheckOut(value);
    setDateError('');
  };



  const saveDates = async () => {
    if (isPastStayDate(checkIn)) {
      setDateError('Check-in cannot be in the past.');
      return;
    }
    if (!isCheckInNightAvailable(checkIn, dayRates)) {
      setDateError('This check-in night is already booked or blocked.');
      return;
    }
    if (!isStayRangeAvailable(checkIn, checkOut, dayRates)) {
      setDateError('Some nights in this range are already booked or blocked.');
      return;
    }

    const ok = await confirm({

      title: 'Update stay dates?',

      message: rebookConfirmMessage(quote, booking.reference_code, checkIn, checkOut),

      confirmLabel: 'Yes, update',

    });

    if (!ok) return;



    setSaving(true);

    try {

      const { data } = await api.patch(`/bookings/admin/${booking.id}/dates`, {

        check_in: checkIn,

        check_out: checkOut,

      });

      toast.success(rebookSuccessMessage(data.pricing_adjustment || quote));

      onSaved?.(data.booking);

      setEditing(false);

      setQuote(null);
      setDateError('');

    } catch (err) {

      toast.error(getApiError(err));

    } finally {

      setSaving(false);

    }

  };



  if (!editing) {

    return (

      <button

        type="button"

        onClick={() => setEditing(true)}

        className={`inline-flex items-center gap-1 text-xs text-aegean-600 hover:text-aegean-800 underline mt-2 ${className}`}

      >

        <CalendarRange size={12} /> Change dates

      </button>

    );

  }



  return (

    <div

      className={`space-y-2 ${inline ? 'mt-2' : 'mt-3 pt-3 border-t border-aegean-100'} ${className}`}

    >

      {!inline && <p className="text-xs font-medium text-aegean-700">Edit stay dates</p>}

      {!inline && (booking.status === 'cancelled' || booking.status === 'rejected') ? (

        <p className="text-[11px] text-aegean-500">

          Rebook on new dates — pricing follows weekday (Mon–Thu) and weekend (Fri–Sun) rates per

          night. Moving to weekends costs more; moving to weekdays may mean a refund.

        </p>

      ) : (

        <p className="text-[11px] text-aegean-500">

          New dates are priced per night (weekday vs weekend). Additional charge or refund is shown

          below before you save.

        </p>

      )}

      <div className="grid grid-cols-2 gap-2">

        <div>

          <label className="block text-[11px] text-aegean-600 mb-0.5">Check-in</label>

          <input

            type="date"

            value={checkIn}

            min={minCheckInDate()}

            onChange={(e) => handleCheckInChange(e.target.value)}

            className="w-full border border-aegean-200 rounded-lg px-2 py-1.5 text-sm"

          />

        </div>

        <div>

          <label className="block text-[11px] text-aegean-600 mb-0.5">Check-out</label>

          <input

            type="date"

            value={checkOut}

            min={minCheckOutDate(checkIn) || minCheckInDate()}

            onChange={(e) => handleCheckOutChange(e.target.value)}

            className="w-full border border-aegean-200 rounded-lg px-2 py-1.5 text-sm"

          />

        </div>

      </div>

      <StayDateRangeCalendar
        roomId={booking.room_id}
        checkIn={checkIn}
        checkOut={checkOut}
        onChange={({ check_in, check_out }) => {
          setCheckIn(check_in);
          setCheckOut(check_out);
          setDateError('');
        }}
        compact
      />

      {dateError && <p className="text-xs text-red-600">{dateError}</p>}

      {datesChanged && (

        <RebookPricePreview quote={quote} loading={quoteLoading} compact={inline} />

      )}

      <div className="flex flex-wrap gap-2">

        <SubmitButton

          type="button"

          onClick={saveDates}

          loading={saving}

          loadingLabel="Saving..."

          className="text-xs py-1.5 px-3"

        >

          Save dates

        </SubmitButton>

        {!inline && (

          <button type="button" onClick={cancelEdit} className="btn-outline text-xs py-1.5 px-3">

            Cancel

          </button>

        )}

      </div>

    </div>

  );

}

