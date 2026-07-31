import { format } from 'date-fns';
import {
  bilaoQtyFromLines,
  boodleQtyFromLines,
  emptyBookingExtras,
} from '../data/bookingAddOns';
import { emptyIslandHoppingForm } from '../data/islandHoppingRates';
import { createRoomLine } from './bookingRoomLines';
import { computeTour, parseQuotationDateRange } from './quotation';

function parseMoney(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveStayDates(quote) {
  const checkIn = String(quote?.checkIn || '').slice(0, 10);
  const checkOut = String(quote?.checkOut || '').slice(0, 10);
  if (checkIn && checkOut) {
    return { check_in: checkIn, check_out: checkOut };
  }

  const range = parseQuotationDateRange(quote?.dateLabel);
  if (range?.start && range?.end) {
    return {
      check_in: format(range.start, 'yyyy-MM-dd'),
      check_out: format(range.end, 'yyyy-MM-dd'),
    };
  }

  return { check_in: '', check_out: '' };
}

function resolveRoomId(roomEntry, rooms) {
  if (roomEntry?.roomId) return String(roomEntry.roomId);
  const label = String(roomEntry?.roomType || '').trim().toUpperCase();
  if (!label) return '';

  const exact = rooms.find((room) => room.name?.toUpperCase() === label);
  if (exact) return String(exact.id);

  const partial = rooms.find((room) => room.name?.toUpperCase().includes(label));
  return partial ? String(partial.id) : '';
}

function quoteRoomsToLines(quoteRooms, rooms) {
  const lines = (quoteRooms || [])
    .filter((entry) => entry?.roomId || entry?.roomType)
    .map((entry) => {
      const occupants = Math.max(1, parseInt(entry.occupants, 10) || 2);
      return createRoomLine({
        room_id: resolveRoomId(entry, rooms),
        adults: occupants,
        children_under6: 0,
        children_7_12: 0,
      });
    });

  return lines.length > 0 ? lines : [createRoomLine()];
}

function quoteExtrasToBookingExtras(quote) {
  const extras = emptyBookingExtras();

  if (quote?.bilaoEnabled && quote.bilaoLines?.length) {
    extras.bilao_enabled = true;
    extras.bilao_qty = bilaoQtyFromLines(quote.bilaoLines);
  }

  if (quote?.boodleEnabled && quote.boodleLines?.length) {
    extras.boodle_fight_enabled = true;
    extras.boodle_qty = boodleQtyFromLines(quote.boodleLines);
  }

  return extras;
}

function quoteIslandHoppingToForm(quote) {
  if (!quote?.tourEnabled) {
    return { enabled: false, data: emptyIslandHoppingForm() };
  }

  const tour = computeTour(quote);
  const totalPax = tour.regularQty + tour.seniorPwdQty + tour.infantQty;

  return {
    enabled: true,
    data: {
      ...emptyIslandHoppingForm(),
      soa_summary: true,
      summary_pax: String(totalPax > 0 ? totalPax : quote.pax || 1),
      summary_amount: String(tour.total || 0),
    },
  };
}

function buildSpecialRequests(quote, quotationReference) {
  const notes = [];

  if (quotationReference) {
    notes.push(`From quotation ${quotationReference}`);
  }
  if (quote?.bookingPlatform?.trim()) {
    notes.push(`Booking platform: ${quote.bookingPlatform.trim()}`);
  }
  if (quote?.customAddonsEnabled && Array.isArray(quote.customAddonLines)) {
    quote.customAddonLines.forEach((line) => {
      const label = String(line?.label || '').trim();
      const detail = String(line?.detail || '').trim();
      const rate = parseMoney(line?.rate);
      if (!label && rate <= 0) return;
      const amount = rate > 0 ? ` — ₱${rate.toLocaleString()}` : '';
      notes.push(`${label || 'Add-on'}${detail ? ` (${detail})` : ''}${amount}`);
    });
  }

  return notes.join('\n');
}

/**
 * Map a saved quotation into manual booking form state.
 */
export function mapQuotationToManualBooking(savedQuote, { rooms = [] } = {}) {
  const quote = savedQuote?.quote_data || savedQuote || {};
  const dates = resolveStayDates(quote);
  const downPayment = parseMoney(quote.downPaymentAmount);
  const island = quoteIslandHoppingToForm(quote);
  const quotationReference = savedQuote?.reference_code || null;

  return {
    quotationId: savedQuote?.id || null,
    quotationReference,
    form: {
      guest_name: String(quote.guestName || savedQuote?.guest_name || '').trim(),
      guest_email: '',
      guest_phone: '',
      valid_id: '',
      estimated_arrival: quote.checkInTime?.trim() || '',
      check_in: dates.check_in,
      check_out: dates.check_out,
      status: 'confirmed',
      special_requests: buildSpecialRequests(quote, quotationReference),
      send_confirmation_email: false,
      payment_method_id: '',
      payment_option: downPayment > 0 ? 'custom' : 'full',
      custom_payment_amount: downPayment > 0 ? String(downPayment) : '',
      admin_discount_amount:
        quote.discountAmount === '' || quote.discountAmount == null
          ? ''
          : String(quote.discountAmount),
      admin_discount_note: String(quote.discountLabel || '').trim(),
    },
    roomLines: quoteRoomsToLines(quote.rooms, rooms),
    bookingExtras: quoteExtrasToBookingExtras(quote),
    islandHoppingEnabled: island.enabled,
    islandHopping: island.data,
  };
}
