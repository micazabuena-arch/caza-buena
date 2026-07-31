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

function parsePaxCount(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function classifyAdditionalPaxLabel(label) {
  const normalized = String(label || 'Adult').trim();
  if (normalized === 'Child (0–6)' || normalized === 'Child (0-6)') return 'under6';
  if (normalized === 'Child (7–12)') return '7_12';
  return 'adult';
}

/** Merge quotation additional-pax lines into the primary room guest counts. */
function applyAdditionalPaxToRoomLines(roomLines, additionalPaxLines) {
  if (!roomLines.length) return roomLines;

  let extraAdults = 0;
  let extraUnder6 = 0;
  let extra7_12 = 0;

  for (const paxRow of additionalPaxLines || []) {
    const count = parsePaxCount(paxRow?.occupants);
    if (count <= 0) continue;
    const kind = classifyAdditionalPaxLabel(paxRow?.label);
    if (kind === 'under6') extraUnder6 += count;
    else if (kind === '7_12') extra7_12 += count;
    else extraAdults += count;
  }

  if (extraAdults === 0 && extraUnder6 === 0 && extra7_12 === 0) {
    return roomLines;
  }

  const targetIndex = roomLines.findIndex((line) => line.room_id);
  const index = targetIndex >= 0 ? targetIndex : 0;
  const line = { ...roomLines[index] };

  line.adults = (parseInt(line.adults, 10) || 1) + extraAdults;
  line.children_under6 = (parseInt(line.children_under6, 10) || 0) + extraUnder6;
  line.children_7_12 = (parseInt(line.children_7_12, 10) || 0) + extra7_12;

  const next = [...roomLines];
  next[index] = line;
  return next;
}

function quoteRoomsToLines(quoteRooms, rooms, additionalPaxLines = []) {
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

  const baseLines = lines.length > 0 ? lines : [createRoomLine()];
  return applyAdditionalPaxToRoomLines(baseLines, additionalPaxLines);
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
    roomLines: quoteRoomsToLines(quote.rooms, rooms, quote.additionalPaxLines),
    bookingExtras: quoteExtrasToBookingExtras(quote),
    islandHoppingEnabled: island.enabled,
    islandHopping: island.data,
  };
}
