import { BILAO_PACKAGES, BOODLE_FIGHT_PACKAGES } from '../data/bookingAddOns';
import { ISLAND_HOPPING_RATES, resolveFacilitationFee } from '../data/islandHoppingRates';

export function emptyQuotationRoom() {
  return { roomType: '', occupants: 2, rate: '', nights: 1 };
}

export function emptyQuotationBoat() {
  return { boatTierId: 'small' };
}

export function emptyQuotationBilaoLine() {
  return { packageId: '', qty: 1 };
}

export function emptyQuotationBoodleLine() {
  return { tierId: '', qty: 1 };
}

export function emptyQuotation() {
  return {
    rmNo: '',
    dateLabel: '',
    guestName: '',
    bookingPlatform: '',
    pax: 2,
    checkInTime: '1:00 PM',
    checkOutTime: '11:00 AM',
    rooms: [emptyQuotationRoom()],
    additionalPaxOccupants: '',
    additionalPaxAmount: '',
    discountLabel: '',
    discountAmount: '',
    downPaymentLabel: '',
    downPaymentAmount: '',
    tourEnabled: true,
    tourRegularQty: 0,
    tourSeniorPwdQty: 0,
    tourInfantQty: 0,
    boats: [emptyQuotationBoat()],
    bilaoLines: [],
    boodleLines: [],
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

/** Support quotes saved before multi-boat / multi-add-on fields. */
export function normalizeQuotation(quote) {
  if (!quote) return emptyQuotation();

  const boats =
    quote.boats?.length > 0
      ? quote.boats.map((b) => ({ boatTierId: b.boatTierId || 'small' }))
      : [{ boatTierId: quote.boatTierId || 'small' }];

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

  return { ...quote, boats, bilaoLines, boodleLines };
}

export function computeAccommodation(quote) {
  const q = normalizeQuotation(quote);
  const roomLines = (q.rooms || []).map((row) => {
    const rate = parseMoney(row.rate);
    const nights = Math.max(1, parseIntSafe(row.nights) || 1);
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

  const additionalPaxAmount = parseMoney(q.additionalPaxAmount);
  const additionalPaxOccupants = parseIntSafe(q.additionalPaxOccupants);
  const additionalPaxLine =
    additionalPaxAmount > 0
      ? {
          roomType: 'Additional pax',
          occupants: additionalPaxOccupants > 0 ? additionalPaxOccupants : '—',
          rate: additionalPaxAmount,
          nights: 1,
          total: additionalPaxAmount,
        }
      : null;

  const accommodationLines = additionalPaxLine
    ? [...roomLines, additionalPaxLine]
    : roomLines;

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

export function computeTour(quote) {
  const q = normalizeQuotation(quote);
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
  const { entrance, boat, garbageFee } = ISLAND_HOPPING_RATES;

  const regularTotal = regularQty * entrance.regular.rate;
  const seniorPwdTotal = seniorPwdQty * entrance.senior.rate;
  const infantTotal = infantQty * entrance.infant.rate;

  const boatLines = (q.boats || [])
    .map((entry) => {
      const selectedBoat =
        boat.find((b) => b.id === entry.boatTierId) || boat.find((b) => b.id === 'small');
      if (!selectedBoat) return null;
      return {
        boat: selectedBoat,
        rate: selectedBoat.rate,
        lineTotal: selectedBoat.rate,
      };
    })
    .filter(Boolean);

  const boatTotal = boatLines.reduce((s, line) => s + line.lineTotal, 0);
  const boatTierIds = boatLines.map((line) => line.boat.id);
  const { amount: facilitation, label: facilitationLabel } = resolveFacilitationFee(boatTierIds);
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

export function computeBilao(quote) {
  const q = normalizeQuotation(quote);
  const aggregated = {};

  (q.bilaoLines || []).forEach((line) => {
    if (!line.packageId) return;
    const pkg = BILAO_PACKAGES.find((p) => p.id === line.packageId);
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

export function computeBoodleFight(quote) {
  const q = normalizeQuotation(quote);
  const aggregated = {};

  (q.boodleLines || []).forEach((line) => {
    if (!line.tierId) return;
    const pkg = BOODLE_FIGHT_PACKAGES.find((p) => p.id === line.tierId);
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

export function computeQuotationTotals(quote) {
  const accommodation = computeAccommodation(quote);
  const tour = computeTour(quote);
  const bilao = computeBilao(quote);
  const boodleFight = computeBoodleFight(quote);
  const addOnsTotal = bilao.total + boodleFight.total;
  const grandTotal = accommodation.balance + tour.total + addOnsTotal;

  return { accommodation, tour, bilao, boodleFight, addOnsTotal, grandTotal };
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
