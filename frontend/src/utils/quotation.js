import { BILAO_PACKAGES, BOODLE_FIGHT_PACKAGES } from '../data/bookingAddOns';
import { ISLAND_HOPPING_RATES, getFacilitationFee } from '../data/islandHoppingRates';

export function emptyQuotationRoom() {
  return { roomType: '', occupants: 2, rate: '', nights: 1 };
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
    discountLabel: '',
    discountAmount: '',
    downPaymentLabel: '',
    downPaymentAmount: '',
    tourEnabled: true,
    tourRegularQty: 0,
    tourSeniorPwdQty: 0,
    tourInfantQty: 0,
    boatTierId: 'small',
    bilaoPackageId: '',
    boodleFightTierId: '',
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

export function computeAccommodation(quote) {
  const roomLines = (quote.rooms || []).map((row) => {
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

  const roomSubtotal = roomLines.reduce((s, r) => s + r.total, 0);
  const discount = parseMoney(quote.discountAmount);
  const afterDiscount = Math.max(0, roomSubtotal - discount);
  const downPayment = parseMoney(quote.downPaymentAmount);
  const balance = Math.max(0, afterDiscount - downPayment);

  return {
    roomLines,
    roomSubtotal,
    discount,
    afterDiscount,
    downPayment,
    balance,
  };
}

export function computeTour(quote) {
  if (!quote.tourEnabled) {
    return {
      regularQty: 0,
      seniorPwdQty: 0,
      infantQty: 0,
      regularTotal: 0,
      seniorPwdTotal: 0,
      infantTotal: 0,
      boat: null,
      boatTotal: 0,
      facilitation: 0,
      garbage: 0,
      total: 0,
    };
  }

  const regularQty = parseIntSafe(quote.tourRegularQty);
  const seniorPwdQty = parseIntSafe(quote.tourSeniorPwdQty);
  const infantQty = parseIntSafe(quote.tourInfantQty);
  const { entrance, boat, garbageFee } = ISLAND_HOPPING_RATES;
  const facilitation = getFacilitationFee(quote.boatTierId);

  const regularTotal = regularQty * entrance.regular.rate;
  const seniorPwdTotal = seniorPwdQty * entrance.senior.rate;
  const infantTotal = infantQty * entrance.infant.rate;
  const selectedBoat =
    boat.find((b) => b.id === quote.boatTierId) || boat.find((b) => b.id === 'small');
  const boatTotal = selectedBoat?.rate || 0;

  const total =
    regularTotal + seniorPwdTotal + infantTotal + boatTotal + facilitation + garbageFee;

  return {
    regularQty,
    seniorPwdQty,
    infantQty,
    regularTotal,
    seniorPwdTotal,
    infantTotal,
    boat: selectedBoat,
    boatTotal,
    facilitation,
    garbage: garbageFee,
    total,
  };
}

export function computeBilao(quote) {
  const pkg = BILAO_PACKAGES.find((p) => p.id === quote.bilaoPackageId) || null;
  return { package: pkg, total: pkg?.price || 0 };
}

export function computeBoodleFight(quote) {
  const pkg = BOODLE_FIGHT_PACKAGES.find((p) => p.id === quote.boodleFightTierId) || null;
  return { package: pkg, total: pkg?.price || 0 };
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
