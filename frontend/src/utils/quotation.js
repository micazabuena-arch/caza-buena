import { BILAO_PACKAGES, BOODLE_FIGHT_PACKAGES } from '../data/bookingAddOns';
import { EXTRA_PERSON_RATES } from '../data/resortRules';
import { ISLAND_HOPPING_RATES, resolveFacilitationFee } from '../data/islandHoppingRates';
import { addDays, differenceInCalendarDays, format, isValid, parse, parseISO } from 'date-fns';

export function emptyQuotationRoom() {
  return { roomId: '', roomType: '', occupants: 2, rate: '', nights: 1 };
}

export function emptyQuotationBoat() {
  return { boatTierId: 'small', rate: '' };
}

export function emptyQuotationBilaoLine() {
  return { packageId: '', qty: 1 };
}

export function emptyQuotationBoodleLine() {
  return { tierId: '', qty: 1 };
}

/** One additional-pax charge line (adult vs child rates differ). */
export function emptyQuotationAdditionalPaxLine(defaultNights = 1) {
  return { label: 'Adult', occupants: '', nights: defaultNights };
}

/** Free-form add-on line (room extension, food, misc charges). */
export function emptyQuotationCustomAddonLine() {
  return { label: '', detail: '', rate: '', qty: 1 };
}

export const CUSTOM_ADDON_LABEL_SUGGESTIONS = [
  'Room extension',
  'Food order',
  'Extra bed',
  'Late checkout',
  'Transport / pickup',
];

export const ADDITIONAL_PAX_LABEL_OPTIONS = ['Adult', 'Child (0–6)', 'Child (7–12)'];

export function emptyQuotation() {
  return {
    documentTitle: 'Quotation',
    rmNo: '',
    dateLabel: '',
    checkIn: '',
    checkOut: '',
    nights: 1,
    guestName: '',
    bookingPlatform: '',
    pax: 2,
    checkInTime: '1:00 PM',
    checkOutTime: '11:00 AM',
    rooms: [emptyQuotationRoom()],
    additionalPaxLines: [emptyQuotationAdditionalPaxLine()],
    discountLabel: '',
    discountAmount: '',
    downPaymentLabel: '',
    downPaymentAmount: '',
    tourEnabled: true,
    tourRegularQty: 0,
    tourSeniorPwdQty: 0,
    tourInfantQty: 0,
    boats: [emptyQuotationBoat()],
    bilaoEnabled: false,
    bilaoLines: [],
    boodleEnabled: false,
    boodleLines: [],
    customAddonsEnabled: false,
    customAddonsSectionTitle: 'Other add-ons',
    customAddonLines: [],
  };
}

function parseMoney(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function parseIntSafe(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Nights between check-in and check-out (check-out day not counted). */
export function calculateQuotationNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const inDate = parseISO(String(checkIn).slice(0, 10));
  const outDate = parseISO(String(checkOut).slice(0, 10));
  if (!isValid(inDate) || !isValid(outDate)) return 0;
  const nights = differenceInCalendarDays(outDate, inDate);
  return nights >= 1 ? nights : 0;
}

function normalizeMonthName(month) {
  const m = String(month || '').trim();
  if (!m) return m;
  return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
}

function parseQuotationLooseDate(value, referenceDate = new Date()) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const formats = [
    'MMMM d, yyyy',
    'MMM d, yyyy',
    'MMMM d yyyy',
    'yyyy-MM-dd',
    'MMMM d',
    'MMM d',
  ];
  for (const fmt of formats) {
    const d = parse(trimmed, fmt, referenceDate);
    if (isValid(d)) return d;
  }
  return null;
}

/** Parse check-in / check-out dates from Date (display) text. */
export function parseQuotationDateRange(dateLabel) {
  const raw = String(dateLabel || '').trim().replace(/\s+/g, ' ');
  if (!raw) return null;

  const dash = /[–\-—]/;

  const isoRange = raw.match(/(\d{4}-\d{2}-\d{2})\s*[–\-—]\s*(\d{4}-\d{2}-\d{2})/);
  if (isoRange) {
    const start = parseISO(isoRange[1]);
    const end = parseISO(isoRange[2]);
    if (isValid(start) && isValid(end)) return { start, end };
  }

  const yearInText = raw.match(/(\d{4})/);
  const year = yearInText ? parseInt(yearInText[1], 10) : new Date().getFullYear();
  const ref = new Date(year, 0, 1);

  // Same month: Aug 1-3, aug 2-3, Aug 1 - 3, 2026
  const sameMonth = raw.match(
    /^([A-Za-z]+)\s*(\d{1,2})\s*[–\-—]\s*(\d{1,2})(?:,?\s*(\d{4}))?$/i
  );
  if (sameMonth) {
    const [, month, dayIn, dayOut, explicitYear] = sameMonth;
    const monthName = normalizeMonthName(month);
    const y = explicitYear ? parseInt(explicitYear, 10) : year;
    const monthRef = new Date(y, 0, 1);
    const start =
      parseQuotationLooseDate(`${monthName} ${dayIn}, ${y}`, monthRef) ||
      parseQuotationLooseDate(`${monthName} ${dayIn}`, monthRef);
    const end =
      parseQuotationLooseDate(`${monthName} ${dayOut}, ${y}`, monthRef) ||
      parseQuotationLooseDate(`${monthName} ${dayOut}`, monthRef);
    if (start && end) return { start, end };
  }

  if (!dash.test(raw)) return null;

  const parts = raw.split(dash).map((part) => part.trim());
  if (parts.length < 2) return null;
  const left = parts[0];
  let right = parts.slice(1).join('-').trim();
  if (!left || !right) return null;

  const leftMonthDay = left.match(/^([A-Za-z]+)\s*(\d{1,2})$/i);
  const rightDayOnly = right.match(/^(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if (leftMonthDay && rightDayOnly) {
    const [, month, dayIn] = leftMonthDay;
    const dayOut = rightDayOnly[1];
    const explicitYear = rightDayOnly[2];
    const monthName = normalizeMonthName(month);
    const y = explicitYear ? parseInt(explicitYear, 10) : year;
    const monthRef = new Date(y, 0, 1);
    const start =
      parseQuotationLooseDate(`${monthName} ${dayIn}, ${y}`, monthRef) ||
      parseQuotationLooseDate(`${monthName} ${dayIn}`, monthRef);
    const end =
      parseQuotationLooseDate(`${monthName} ${dayOut}, ${y}`, monthRef) ||
      parseQuotationLooseDate(`${monthName} ${dayOut}`, monthRef);
    if (start && end) return { start, end };
  }

  const rightYearMatch = right.match(/,?\s*(\d{4})\s*$/);
  const rangeYear = rightYearMatch ? parseInt(rightYearMatch[1], 10) : year;
  const rightBody = right.replace(/,?\s*\d{4}\s*$/, '').trim();
  const rangeRef = new Date(rangeYear, 0, 1);

  const normalizeDatePart = (part) => {
    const match = part.match(/^([A-Za-z]+)\s+(.+)$/);
    if (!match) return part;
    return `${normalizeMonthName(match[1])} ${match[2]}`;
  };

  const leftNorm = normalizeDatePart(left);
  const rightNorm = normalizeDatePart(rightBody);

  const start =
    parseQuotationLooseDate(leftNorm.includes(',') ? leftNorm : `${leftNorm}, ${rangeYear}`, rangeRef) ||
    parseQuotationLooseDate(leftNorm, rangeRef);
  let end =
    parseQuotationLooseDate(
      rightNorm.includes(',') ? rightNorm : `${rightNorm}, ${rangeYear}`,
      rangeRef
    ) || parseQuotationLooseDate(rightNorm, rangeRef);

  if (!start || !end) return null;

  if (differenceInCalendarDays(end, start) < 0) {
    const nextYearRef = new Date(rangeYear + 1, 0, 1);
    end =
      parseQuotationLooseDate(`${rightBody}, ${rangeYear + 1}`, nextYearRef) ||
      parseQuotationLooseDate(rightBody, nextYearRef) ||
      end;
  }

  return { start, end };
}

/** Derive stay nights from the manual Date (display) text, e.g. Aug 1 - Aug 3 → 2. */
export function parseQuotationNightsFromDateLabel(dateLabel) {
  const range = parseQuotationDateRange(dateLabel);
  if (!range) return 0;
  const nights = differenceInCalendarDays(range.end, range.start);
  return nights >= 1 ? nights : 0;
}

/** Whether nights were derived from the Date (display) field. */
export function getQuotationNightsFromDateLabel(dateLabel) {
  return parseQuotationNightsFromDateLabel(dateLabel);
}

/** Parsed check-in / check-out labels for the quotation form preview. */
export function describeQuotationDateRange(dateLabel) {
  const range = parseQuotationDateRange(dateLabel);
  if (!range) return null;
  const nights = differenceInCalendarDays(range.end, range.start);
  if (nights < 1) return null;
  return {
    checkInLabel: format(range.start, 'MMM d, yyyy'),
    checkOutLabel: format(range.end, 'MMM d, yyyy'),
    nights,
  };
}

/** Guest-facing stay range for the quotation header, e.g. MAY 22–24, 2026. */
export function formatQuotationDateLabel(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '';
  try {
    const a = format(parseISO(String(checkIn).slice(0, 10)), 'MMMM d').toUpperCase();
    const b = format(parseISO(String(checkOut).slice(0, 10)), 'MMMM d, yyyy').toUpperCase();
    return `${a}–${b}`;
  } catch {
    return `${checkIn} – ${checkOut}`;
  }
}

/** Date line on the PDF — manual display label first, else from stored dates. */
export function getQuotationDateLabel(quote) {
  const manual = String(quote?.dateLabel || '').trim();
  if (manual) return manual;
  return formatQuotationDateLabel(quote?.checkIn, quote?.checkOut) || '';
}

/** Main stay nights — from Date (display) text, else booking dates. */
export function getQuotationStayNights(quote) {
  const fromLabel = parseQuotationNightsFromDateLabel(quote?.dateLabel);
  if (fromLabel > 0) return fromLabel;
  const fromDates = calculateQuotationNights(quote?.checkIn, quote?.checkOut);
  if (fromDates > 0) return fromDates;
  return 1;
}

/** Friday=5, Saturday=6, Sunday=0 — same as booking pricing. */
export function isWeekendNight(dateStr) {
  const d = parseISO(String(dateStr).slice(0, 10));
  if (!isValid(d)) return false;
  const day = d.getDay();
  return day === 0 || day === 5 || day === 6;
}

/** Resolve check-in date from quotation fields. */
export function getQuotationCheckIn(quote) {
  const direct = String(quote?.checkIn || '').slice(0, 10);
  if (direct) return direct;
  const range = parseQuotationDateRange(quote?.dateLabel);
  return range?.start ? format(range.start, 'yyyy-MM-dd') : '';
}

/** Nightly room rate for one date (holiday > weekend > weekday). */
export function resolveRoomNightlyPrice(room, dateStr) {
  if (!room) return 0;
  const night = String(dateStr || '').slice(0, 10);
  const holiday = (room.holiday_rates || []).find(
    (row) => night >= String(row.start_date).slice(0, 10) && night <= String(row.end_date).slice(0, 10)
  );
  if (holiday) return parseMoney(holiday.price_per_night);

  if (isWeekendNight(night)) {
    const weekend =
      room.price_weekend != null ? Number(room.price_weekend) : Number(room.price_per_night);
    if (Number.isFinite(weekend)) return weekend;
  }

  return parseMoney(room.price_per_night);
}

/** Sum nightly room rates across the stay (check-out day not counted). */
export function calculateQuotedRoomStaySubtotal(room, checkIn, nights) {
  const nightCount = Math.max(0, parseIntSafe(nights));
  if (!room || nightCount === 0) return 0;

  const start = parseISO(String(checkIn || '').slice(0, 10));
  if (!isValid(start)) return parseMoney(room.price_per_night) * nightCount;

  let total = 0;
  for (let i = 0; i < nightCount; i += 1) {
    total += resolveRoomNightlyPrice(room, format(addDays(start, i), 'yyyy-MM-dd'));
  }
  return total;
}

/** Average nightly rate for the stay (for the single rate field on quotation rooms). */
export function getQuotedRoomNightlyRate(room, checkIn, nights) {
  const nightCount = Math.max(1, parseIntSafe(nights) || 1);
  const subtotal = calculateQuotedRoomStaySubtotal(room, checkIn, nightCount);
  return subtotal / nightCount;
}

/** Dropdown label: date-aware rate when stay dates are set, otherwise weekday–weekend range. */
export function formatRoomListOptionLabel(room, quote) {
  const nights = getQuotationStayNights(quote);
  const checkIn = getQuotationCheckIn(quote);

  if (checkIn && nights > 0) {
    const nightly = getQuotedRoomNightlyRate(room, checkIn, nights);
    return `${room.name} — ₱${Number(nightly).toLocaleString()}/night`;
  }

  const weekday = Number(room.price_per_night || 0).toLocaleString();
  const weekend = Number(room.price_weekend ?? room.price_per_night ?? 0).toLocaleString();
  if (weekday !== weekend) {
    return `${room.name} — ₱${weekday}–₱${weekend}/night`;
  }
  return `${room.name} — ₱${weekday}/night`;
}

/** Count weekday vs weekend nights for a span starting at check-in. */
export function countWeekdayWeekendNights(checkIn, nightCount) {
  const nights = Math.max(0, parseIntSafe(nightCount));
  if (nights === 0) return { weekdayNights: 0, weekendNights: 0 };
  const start = parseISO(String(checkIn || '').slice(0, 10));
  if (!isValid(start)) {
    return { weekdayNights: nights, weekendNights: 0 };
  }
  let weekdayNights = 0;
  let weekendNights = 0;
  for (let i = 0; i < nights; i += 1) {
    const dateStr = format(addDays(start, i), 'yyyy-MM-dd');
    if (isWeekendNight(dateStr)) weekendNights += 1;
    else weekdayNights += 1;
  }
  return { weekdayNights, weekendNights };
}

export function getAdditionalPaxContext(quote, options = {}) {
  const mainNights = getQuotationStayNights(quote);
  let checkIn = quote?.checkIn || '';
  if (!checkIn && quote?.dateLabel) {
    const range = parseQuotationDateRange(quote.dateLabel);
    if (range) checkIn = format(range.start, 'yyyy-MM-dd');
  }
  return {
    checkIn,
    fallbackNights: mainNights > 0 ? mainNights : 1,
    rates: options.extraPersonRates || EXTRA_PERSON_RATES,
  };
}

function resolveAdditionalPaxLineNights(row, fallbackNights = 1) {
  const maxNights = Math.max(1, parseIntSafe(fallbackNights) || 1);
  const requested =
    row?.nights !== '' && row?.nights != null
      ? parseIntSafe(row.nights) || maxNights
      : maxNights;
  return Math.min(Math.max(1, requested), maxNights);
}

/** Cap additional-pax nights to the main stay length (for form input). */
export function clampAdditionalPaxLineNights(value, maxNights) {
  const max = Math.max(1, parseIntSafe(maxNights) || 1);
  if (value === '' || value == null) return '';
  const requested = parseIntSafe(value);
  if (requested < 1) return '1';
  return String(Math.min(requested, max));
}

/** Additional pax line total from resort extra-person rates × pax × nights. */
export function computeAdditionalPaxLineTotal(row, context = {}) {
  const occupants = parseIntSafe(row?.occupants);
  if (occupants <= 0) return 0;

  const rates = context.rates || EXTRA_PERSON_RATES;
  const nights = resolveAdditionalPaxLineNights(row, context.fallbackNights || 1);
  const label = String(row?.label || 'Adult').trim();

  if (label === 'Child (0–6)') return 0;

  if (label === 'Child (7–12)') {
    return occupants * nights * rates.child_7_12;
  }

  const { weekdayNights, weekendNights } = countWeekdayWeekendNights(context.checkIn, nights);
  return (
    occupants *
    (weekdayNights * rates.adult_weekday + weekendNights * rates.adult_weekend)
  );
}

/** Build accommodation table row(s) for one additional-pax line. */
function buildAdditionalPaxAccommodationLines(row, paxContext, mainNights) {
  const occupants = parseIntSafe(row?.occupants);
  if (occupants <= 0) return [];

  const rates = paxContext.rates || EXTRA_PERSON_RATES;
  const label = String(row?.label || '').trim();
  const lineNights = resolveAdditionalPaxLineNights(row, mainNights);
  const baseType = label ? `Additional pax — ${label}` : 'Additional pax';

  if (label === 'Child (0–6)') {
    return [
      {
        roomType: baseType,
        occupants,
        rate: 0,
        nights: lineNights,
        total: 0,
      },
    ];
  }

  if (label === 'Child (7–12)') {
    const rate = rates.child_7_12;
    return [
      {
        roomType: baseType,
        occupants,
        rate,
        nights: lineNights,
        total: occupants * lineNights * rate,
      },
    ];
  }

  const { weekdayNights, weekendNights } = countWeekdayWeekendNights(
    paxContext.checkIn,
    lineNights
  );
  const lines = [];

  if (weekdayNights > 0) {
    lines.push({
      roomType: weekendNights > 0 ? `${baseType} (weekday)` : baseType,
      occupants,
      rate: rates.adult_weekday,
      nights: weekdayNights,
      total: occupants * weekdayNights * rates.adult_weekday,
    });
  }
  if (weekendNights > 0) {
    lines.push({
      roomType: weekdayNights > 0 ? `${baseType} (weekend)` : baseType,
      occupants,
      rate: rates.adult_weekend,
      nights: weekendNights,
      total: occupants * weekendNights * rates.adult_weekend,
    });
  }

  return lines;
}

/** Human-readable breakdown for the quotation form preview. */
export function describeAdditionalPaxLine(row, context = {}) {
  const occupants = parseIntSafe(row?.occupants);
  const pax = occupants > 0 ? occupants : 1;
  const nights = resolveAdditionalPaxLineNights(row, context.fallbackNights || 1);
  const rates = context.rates || EXTRA_PERSON_RATES;
  const label = String(row?.label || 'Adult').trim();
  const lineTotal = computeAdditionalPaxLineTotal(
    occupants > 0 ? row : { ...row, occupants: 1 },
    context
  );

  let detailPart = 'free';
  if (label === 'Child (7–12)') {
    detailPart = `₱${formatQuoteAmount(rates.child_7_12)}/night × ${nights} night${
      nights !== 1 ? 's' : ''
    }`;
  } else if (label === 'Adult') {
    const { weekdayNights, weekendNights } = countWeekdayWeekendNights(context.checkIn, nights);
    const parts = [];
    if (weekdayNights > 0) {
      parts.push(
        `₱${formatQuoteAmount(rates.adult_weekday)}/night × ${weekdayNights} weekday night${
          weekdayNights !== 1 ? 's' : ''
        }`
      );
    }
    if (weekendNights > 0) {
      parts.push(
        `₱${formatQuoteAmount(rates.adult_weekend)}/night × ${weekendNights} weekend night${
          weekendNights !== 1 ? 's' : ''
        }`
      );
    }
    detailPart = parts.length > 0 ? parts.join(' + ') : `₱${formatQuoteAmount(rates.adult_weekday)}/night`;
  }

  return {
    lineTotal: occupants > 0 ? lineTotal : 0,
    paxPart: occupants > 1 ? `${occupants} pax × ` : '',
    detailPart,
    nights,
  };
}

/** Support quotes saved before multi-boat / multi-add-on / multi-pax fields. */
export function normalizeQuotation(quote) {
  if (!quote) return emptyQuotation();

  const boats =
    quote.boats?.length > 0
      ? quote.boats.map((b) => ({
          boatTierId: b.boatTierId || 'small',
          rate: b.rate ?? '',
        }))
      : [{ boatTierId: quote.boatTierId || 'small', rate: quote.boatRate ?? '' }];

  let bilaoLines = quote.bilaoLines;
  if (!Array.isArray(bilaoLines)) {
    bilaoLines = quote.bilaoPackageId
      ? [{ packageId: quote.bilaoPackageId, qty: 1 }]
      : [];
  }

  let boodleLines = quote.boodleLines;
  if (!Array.isArray(boodleLines)) {
    boodleLines = quote.boodleFightTierId
      ? [{ tierId: quote.boodleFightTierId, qty: 1 }]
      : [];
  }

  const bilaoEnabled =
    quote.bilaoEnabled != null ? Boolean(quote.bilaoEnabled) : bilaoLines.length > 0;
  const boodleEnabled =
    quote.boodleEnabled != null ? Boolean(quote.boodleEnabled) : boodleLines.length > 0;

  const mainNights = getQuotationStayNights(quote);

  // Migrate single additionalPaxOccupants / additionalPaxAmount → additionalPaxLines[]
  let additionalPaxLines = quote.additionalPaxLines;
  if (!Array.isArray(additionalPaxLines)) {
    const legacyAmount = quote.additionalPaxAmount;
    const legacyOccupants = quote.additionalPaxOccupants;
    const hasLegacy =
      (legacyAmount !== '' && legacyAmount != null) ||
      (legacyOccupants !== '' && legacyOccupants != null);
    if (hasLegacy) {
      additionalPaxLines = [
        {
          label: 'Adult',
          occupants: legacyOccupants ?? '',
          nights: mainNights > 0 ? mainNights : 1,
        },
      ];
    } else {
      additionalPaxLines = [emptyQuotationAdditionalPaxLine()];
    }
  }
  if (additionalPaxLines.length === 0) {
    additionalPaxLines = [emptyQuotationAdditionalPaxLine()];
  }
  additionalPaxLines = additionalPaxLines.map((line) => ({
    ...line,
    nights: clampAdditionalPaxLineNights(
      line.nights !== '' && line.nights != null
        ? line.nights
        : mainNights > 0
          ? mainNights
          : 1,
      mainNights > 0 ? mainNights : 1
    ),
  }));

  let customAddonLines = quote.customAddonLines;
  if (!Array.isArray(customAddonLines)) {
    customAddonLines = [];
  }
  const customAddonsEnabled =
    quote.customAddonsEnabled != null
      ? Boolean(quote.customAddonsEnabled)
      : customAddonLines.length > 0;

  return {
    ...quote,
    documentTitle: quote.documentTitle?.trim() || 'Quotation',
    dateLabel: getQuotationDateLabel(quote),
    nights: mainNights,
    rooms: (quote.rooms || [emptyQuotationRoom()]).map((row) => ({
      ...row,
      nights: mainNights,
    })),
    boats,
    bilaoEnabled,
    bilaoLines,
    boodleEnabled,
    boodleLines,
    additionalPaxLines,
    customAddonsEnabled,
    customAddonsSectionTitle: quote.customAddonsSectionTitle?.trim() || 'Other add-ons',
    customAddonLines,
  };
}

export function computeAccommodation(quote, options = {}) {
  const q = normalizeQuotation(quote);
  const paxContext = getAdditionalPaxContext(q, options);
  const mainNights = paxContext.fallbackNights;
  const roomLines = (q.rooms || []).map((row) => {
    const rate = parseMoney(row.rate);
    const nights = mainNights > 0 ? mainNights : Math.max(1, parseIntSafe(row.nights) || 1);
    const occupants = Math.max(1, parseIntSafe(row.occupants) || 1);
    const total = rate * nights;
    return {
      roomType: row.roomType?.trim() || 'Room',
      occupants,
      rate,
      nights,
      total,
    };
  });

  // Adults split into weekday / weekend rows when both apply (no blended average rate).
  const additionalPaxLines = (q.additionalPaxLines || []).flatMap((row) =>
    buildAdditionalPaxAccommodationLines(row, paxContext, mainNights)
  );

  const accommodationLines = [...roomLines, ...additionalPaxLines];

  const roomSubtotal = accommodationLines.reduce((s, r) => s + r.total, 0);
  const discount = parseMoney(q.discountAmount);
  const afterDiscount = Math.max(0, roomSubtotal - discount);
  const downPayment = parseMoney(q.downPaymentAmount);
  const balance = Math.max(0, afterDiscount - downPayment);

  return {
    roomLines: accommodationLines,
    roomSubtotal,
    discount,
    afterDiscount,
    downPayment,
    balance,
  };
}

export function computeTour(quote, options = {}) {
  const q = normalizeQuotation(quote);
  const rates = options.islandHoppingRates || ISLAND_HOPPING_RATES;
  if (!q.tourEnabled) {
    return {
      regularQty: 0,
      seniorPwdQty: 0,
      infantQty: 0,
      regularTotal: 0,
      seniorPwdTotal: 0,
      infantTotal: 0,
      boatLines: [],
      boatTotal: 0,
      facilitation: 0,
      facilitationLines: [],
      garbageQty: 0,
      garbage: 0,
      total: 0,
    };
  }

  const regularQty = parseIntSafe(q.tourRegularQty);
  const seniorPwdQty = parseIntSafe(q.tourSeniorPwdQty);
  const infantQty = parseIntSafe(q.tourInfantQty);
  const { entrance, garbageFee } = rates;
  const boatList = rates.boat;

  const regularTotal = regularQty * entrance.regular.rate;
  const seniorPwdTotal = seniorPwdQty * entrance.senior.rate;
  const infantTotal = infantQty * entrance.infant.rate;

  const boatLines = (q.boats || [])
    .map((entry) => {
      const selectedBoat =
        boatList.find((b) => b.id === entry.boatTierId) || boatList.find((b) => b.id === 'small');
      if (!selectedBoat) return null;
      // Quoted line rate wins so extract/print keep the number shown on the quotation.
      const storedRate = parseMoney(entry.rate);
      const rate = storedRate > 0 ? storedRate : selectedBoat.rate;
      return {
        boat: selectedBoat,
        rate,
        lineTotal: rate,
      };
    })
    .filter(Boolean);

  const boatTotal = boatLines.reduce((s, line) => s + line.lineTotal, 0);
  const boatTierIds = boatLines.map((line) => line.boat.id);
  const { amount: facilitation, label: facilitationLabel } = resolveFacilitationFee(
    boatTierIds,
    rates
  );
  const facilitationLines =
    facilitation > 0
      ? [{ label: facilitationLabel, rate: facilitation, qty: 1, total: facilitation }]
      : [];
  const garbageQty = boatLines.length;
  const garbage = garbageQty * garbageFee;

  const total =
    regularTotal + seniorPwdTotal + infantTotal + boatTotal + facilitation + garbage;

  return {
    regularQty,
    seniorPwdQty,
    infantQty,
    regularTotal,
    seniorPwdTotal,
    infantTotal,
    boatLines,
    boatTotal,
    facilitation,
    facilitationLines,
    garbageQty,
    garbage,
    total,
  };
}

export function computeBilao(quote, options = {}) {
  const q = normalizeQuotation(quote);
  const bilaoPackages = options.foodAddOnRates?.bilaoPackages || BILAO_PACKAGES;
  if (!q.bilaoEnabled) {
    return { lines: [], total: 0 };
  }
  const aggregated = {};

  (q.bilaoLines || []).forEach((line) => {
    if (!line.packageId) return;
    const pkg = bilaoPackages.find((p) => p.id === line.packageId);
    if (!pkg) return;
    const qty = Math.max(1, parseIntSafe(line.qty) || 1);
    if (!aggregated[pkg.id]) {
      aggregated[pkg.id] = { package: pkg, qty: 0 };
    }
    aggregated[pkg.id].qty += qty;
  });

  const lines = Object.values(aggregated).map(({ package: pkg, qty }) => ({
    package: pkg,
    qty,
    total: pkg.price * qty,
  }));

  return {
    lines,
    total: lines.reduce((s, l) => s + l.total, 0),
  };
}

export function computeBoodleFight(quote, options = {}) {
  const q = normalizeQuotation(quote);
  const boodlePackages = options.foodAddOnRates?.boodlePackages || BOODLE_FIGHT_PACKAGES;
  if (!q.boodleEnabled) {
    return { lines: [], total: 0 };
  }
  const aggregated = {};

  (q.boodleLines || []).forEach((line) => {
    if (!line.tierId) return;
    const pkg = boodlePackages.find((p) => p.id === line.tierId);
    if (!pkg) return;
    const qty = Math.max(1, parseIntSafe(line.qty) || 1);
    if (!aggregated[pkg.id]) {
      aggregated[pkg.id] = { package: pkg, qty: 0 };
    }
    aggregated[pkg.id].qty += qty;
  });

  const lines = Object.values(aggregated).map(({ package: pkg, qty }) => ({
    package: pkg,
    qty,
    total: pkg.price * qty,
  }));

  return {
    lines,
    total: lines.reduce((s, l) => s + l.total, 0),
  };
}

export function computeCustomAddons(quote) {
  const q = normalizeQuotation(quote);
  if (!q.customAddonsEnabled) {
    return { lines: [], total: 0, sectionTitle: q.customAddonsSectionTitle };
  }

  const lines = (q.customAddonLines || [])
    .map((row) => {
      const label = String(row.label || '').trim();
      const detail = String(row.detail || '').trim();
      const rate = parseMoney(row.rate);
      const qty = Math.max(1, parseIntSafe(row.qty) || 1);
      if (!label && rate <= 0) return null;
      const total = rate * qty;
      return {
        label: label || 'Add-on',
        detail,
        rate,
        qty,
        total,
      };
    })
    .filter(Boolean);

  return {
    lines,
    total: lines.reduce((s, line) => s + line.total, 0),
    sectionTitle: q.customAddonsSectionTitle,
  };
}

export function computeQuotationTotals(quote, options = {}) {
  const accommodation = computeAccommodation(quote, options);
  const tour = computeTour(quote, options);
  const bilao = computeBilao(quote, options);
  const boodleFight = computeBoodleFight(quote, options);
  const customAddons = computeCustomAddons(quote);
  const addOnsTotal = bilao.total + boodleFight.total + customAddons.total;
  const grandTotal = accommodation.balance + tour.total + addOnsTotal;

  return { accommodation, tour, bilao, boodleFight, customAddons, addOnsTotal, grandTotal };
}

/** Format for document cells — 2 decimals when needed. */
export function formatQuoteAmount(value) {
  const num = Number(value) || 0;
  const rounded = Math.round(num * 100) / 100;
  if (Number.isInteger(rounded)) {
    return rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatQuoteParen(value) {
  const n = Math.abs(Number(value) || 0);
  return n > 0 ? `(${formatQuoteAmount(n)})` : '';
}
