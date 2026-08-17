import { format } from 'date-fns';
import {
  bilaoQtyFromLines,
  boodleQtyFromLines,
  emptyBookingExtras,
} from '../data/bookingAddOns';
import { emptyIslandHoppingForm } from '../data/islandHoppingRates';
import { createRoomLine } from './bookingRoomLines';
import {
  computeAccommodation,
  computeCustomAddons,
  computeQuotationTotals,
  computeTour,
  normalizeQuotation,
  parseQuotationDateRange,
} from './quotation';

function parseMoney(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDiscountAmount(value) {
  const amount = parseMoney(value);
  return amount > 0 ? String(amount) : '';
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

function quoteCustomAddonsToRows(quote) {
  return computeCustomAddons(quote)
    .lines.filter((line) => line.total > 0)
    .map((line) => ({
      label: line.label,
      description: line.detail || (line.qty > 1 ? `${line.qty} × ₱${line.rate}` : ''),
      amount: line.total,
    }));
}

function quoteExtrasToBookingExtras(quote) {
  const extras = emptyBookingExtras();
  const bilaoQty = bilaoQtyFromLines(quote.bilaoLines || []);
  const boodleQty = boodleQtyFromLines(quote.boodleLines || []);
  const hasBilao =
    quote.bilaoEnabled || Object.values(bilaoQty).some((qty) => qty > 0);
  const hasBoodle =
    quote.boodleEnabled || Object.values(boodleQty).some((qty) => qty > 0);

  if (hasBilao) {
    extras.bilao_enabled = true;
    extras.bilao_qty = bilaoQty;
  }

  if (hasBoodle) {
    extras.boodle_fight_enabled = true;
    extras.boodle_qty = boodleQty;
  }

  return extras;
}

function quoteIslandHoppingToForm(quote, islandHoppingRates) {
  const tour = computeTour(quote, { islandHoppingRates });
  const hasTour = tour.total > 0;

  if (!hasTour) {
    return { enabled: false, data: emptyIslandHoppingForm() };
  }

  const totalPax = tour.regularQty + tour.seniorPwdQty + tour.infantQty;

  return {
    enabled: true,
    data: {
      ...emptyIslandHoppingForm(),
      soa_summary: true,
      summary_pax: String(totalPax > 0 ? totalPax : quote.pax || 1),
      summary_amount: String(tour.total),
      summary_boats: (tour.boatLines || []).map((line) => ({
        id: line.boat?.id || '',
        label: line.boat?.label || '',
        rate: line.rate,
      })),
    },
  };
}

function resolvePaymentFields(quote, totals, depositPercent = 20) {
  const downPayment = parseMoney(quote.downPaymentAmount);
  if (downPayment <= 0) {
    return { payment_option: 'full', custom_payment_amount: '' };
  }

  const pct = Number(depositPercent) || 20;
  const depositFromQuotedTotal =
    totals.grandTotal > 0
      ? Math.round(((totals.grandTotal * pct) / 100) * 100) / 100
      : 0;

  if (depositFromQuotedTotal > 0 && Math.abs(downPayment - depositFromQuotedTotal) < 0.01) {
    return { payment_option: 'deposit', custom_payment_amount: '' };
  }

  return {
    payment_option: 'custom',
    custom_payment_amount: String(downPayment),
  };
}

function buildQuotedAccommodationPricing(quote, bookingRoomLines) {
  const normalized = normalizeQuotation(quote);
  const accommodation = computeAccommodation(normalized);
  const mainNights = normalized.nights > 0 ? normalized.nights : 1;

  const quoteRooms = (normalized.rooms || []).filter(
    (entry) => entry?.roomId || entry?.roomType
  );
  const quoteRoomTotals = quoteRooms.map((row) => parseMoney(row.rate) * mainNights);
  const roomOnlyTotal = quoteRoomTotals.reduce((sum, total) => sum + total, 0);
  const additionalPaxTotal = Math.max(0, accommodation.roomSubtotal - roomOnlyTotal);

  const bookedLines = (bookingRoomLines || []).filter((line) => line.room_id);
  const lineSubtotals = bookedLines.map((_, index) => {
    let subtotal = quoteRoomTotals[index] || 0;
    if (index === 0) subtotal += additionalPaxTotal;
    return subtotal;
  });

  const lineSubtotalsByLineId = {};
  bookedLines.forEach((line, index) => {
    lineSubtotalsByLineId[line.id] = lineSubtotals[index];
  });

  return {
    accommodationSubtotal: accommodation.roomSubtotal,
    lineSubtotals,
    lineSubtotalsByLineId,
    discount: accommodation.discount,
    afterDiscount: accommodation.afterDiscount,
  };
}

/**
 * Map a saved or in-progress quotation into manual booking form state.
 *
 * Quotation field → booking field:
 * - guestName → guest_name
 * - dateLabel/checkIn/checkOut → check_in, check_out
 * - rooms + additionalPaxLines → roomLines (guest counts)
 * - discountAmount/Label → admin_discount_amount/note (room stay only)
 * - downPaymentAmount → payment_option / custom_payment_amount
 * - tour* → island hopping SOA summary (quoted boat rates)
 * - bilao/boodle → bookingExtras
 * - customAddonLines → quoted_addons
 */
export function mapQuotationToManualBooking(
  savedQuote,
  { rooms = [], depositPercent = 20, islandHoppingRates, foodAddOnRates } = {}
) {
  const quote = normalizeQuotation(savedQuote?.quote_data || savedQuote || {});
  const totals = computeQuotationTotals(quote, { islandHoppingRates, foodAddOnRates });
  const dates = resolveStayDates(quote);
  const island = quoteIslandHoppingToForm(quote, islandHoppingRates);
  const payment = resolvePaymentFields(quote, totals, depositPercent);
  const quotationReference = savedQuote?.reference_code || null;
  const discountAmount = formatDiscountAmount(quote.discountAmount);
  const discountNote = String(quote.discountLabel || '').trim();
  const roomLines = quoteRoomsToLines(quote.rooms, rooms, quote.additionalPaxLines);
  const quotedAccommodation = buildQuotedAccommodationPricing(quote, roomLines);

  return {
    quotationId: savedQuote?.id || null,
    quotationReference,
    quotedGrandTotal: totals.grandTotal,
    quotationPricing: quotedAccommodation,
    form: {
      guest_name: String(quote.guestName || savedQuote?.guest_name || '').trim(),
      guest_email: '',
      guest_phone: '',
      valid_id: '',
      estimated_arrival: quote.checkInTime?.trim() || '',
      check_in: dates.check_in,
      check_out: dates.check_out,
      status: 'confirmed',
      special_requests: '',
      send_confirmation_email: true,
      payment_method_id: '',
      payment_option: payment.payment_option,
      custom_payment_amount: payment.custom_payment_amount,
      admin_discount_amount: discountAmount,
      admin_discount_note: discountNote,
    },
    roomLines,
    bookingExtras: quoteExtrasToBookingExtras(quote),
    islandHoppingEnabled: island.enabled,
    islandHopping: island.data,
    quotedAddons: quoteCustomAddonsToRows(quote),
  };
}
