/** Hundred Islands hopping rates (mirrors backend) */

export const ISLAND_HOPPING_RATES = {
  entrance: {
    infant: { maxAge: 4, label: 'Entrance fee (0–4 years old)', rate: 20 },
    regular: { minAge: 5, maxAge: 59, label: 'Entrance fee (5–59 years old)', rate: 130 },
    senior: { label: 'Senior citizen (with 20% discount)', rate: 108 },
    pwd: { label: 'PWD (with 20% discount)', rate: 108 },
  },
  boat: [
    { id: 'small', label: 'SMALL (1–5 PAX)', min: 1, max: 5, rate: 1600 },
    { id: 'medium', label: 'MEDIUM (6–10 PAX)', min: 6, max: 10, rate: 2000 },
    { id: 'large', label: 'LARGE (11–15 PAX)', min: 11, max: 15, rate: 2400 },
    { id: 'deluxe', label: 'DELUXE (16–20 PAX)', min: 16, max: 20, rate: 2800 },
  ],
  facilitationFee: 300,
  /** Facilitation fee for Deluxe boat tier (16–20 pax); other tiers use facilitationFee. */
  deluxeFacilitationFee: 500,
  garbageFee: 200,
  maxPassengers: 20,
};

const BOAT_TIER_NAMES = { small: 'Small', medium: 'Medium', large: 'Large', deluxe: 'Deluxe' };

/**
 * One flat facilitation fee per tour (not per boat).
 * - 1 standard boat (Small/Medium/Large): ₱300
 * - Deluxe boat OR 2+ boats: ₱500
 */
export function resolveFacilitationFee(boatTierIds) {
  const ids = (Array.isArray(boatTierIds) ? boatTierIds : [boatTierIds]).filter(Boolean);
  if (ids.length === 0) return { amount: 0, label: 'Facilitation fee' };

  const hasDeluxe = ids.some((id) => id === 'deluxe');
  const multiBoat = ids.length >= 2;

  if (multiBoat || hasDeluxe) {
    if (hasDeluxe && ids.length === 1) {
      return {
        amount: ISLAND_HOPPING_RATES.deluxeFacilitationFee,
        label: 'Facilitation fee (Deluxe)',
      };
    }
    if (multiBoat && !hasDeluxe) {
      return {
        amount: ISLAND_HOPPING_RATES.deluxeFacilitationFee,
        label: 'Facilitation fee (Multiple boats)',
      };
    }
    return {
      amount: ISLAND_HOPPING_RATES.deluxeFacilitationFee,
      label: 'Facilitation fee',
    };
  }

  const size = BOAT_TIER_NAMES[ids[0]];
  return {
    amount: ISLAND_HOPPING_RATES.facilitationFee,
    label: size ? `Facilitation fee (${size})` : 'Facilitation fee',
  };
}

/** @deprecated Prefer resolveFacilitationFee — kept for single-boat callers. */
export function getFacilitationFee(boatTierId) {
  return resolveFacilitationFee([boatTierId]).amount;
}

function entranceForPassenger(passenger) {
  const age = parseInt(passenger.age, 10);
  if (!Number.isFinite(age) || age < 0) return null;
  if (age <= ISLAND_HOPPING_RATES.entrance.infant.maxAge) {
    return ISLAND_HOPPING_RATES.entrance.infant;
  }
  if (passenger.is_pwd) {
    return ISLAND_HOPPING_RATES.entrance.pwd;
  }
  if (passenger.is_senior || age >= 60) {
    return ISLAND_HOPPING_RATES.entrance.senior;
  }
  return ISLAND_HOPPING_RATES.entrance.regular;
}

function boatForPax(count) {
  return ISLAND_HOPPING_RATES.boat.find((b) => count >= b.min && count <= b.max) || null;
}

export function isSeniorPassenger(passenger) {
  const age = parseInt(passenger?.age, 10);
  return Boolean(passenger?.is_senior) || (Number.isFinite(age) && age >= 60);
}

export function isPwdPassenger(passenger) {
  return Boolean(passenger?.is_pwd);
}

export function parseIslandHoppingData(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export function calculateIslandHopping(passengers) {
  const validPassengers = (passengers || []).filter((p) => p.full_name?.trim());
  const pax = validPassengers.length;
  if (pax < 1) return null;

  const boat = boatForPax(pax);
  if (!boat) return { error: `Maximum ${ISLAND_HOPPING_RATES.maxPassengers} passengers per boat.` };

  const breakdown = [];
  let entranceTotal = 0;

  validPassengers.forEach((p) => {
    const entrance = entranceForPassenger(p);
    if (!entrance) return;
    entranceTotal += entrance.rate;
    breakdown.push({
      description: `${entrance.label} — ${p.full_name}`,
      quantity: 1,
      unit_price: entrance.rate,
      subtotal: entrance.rate,
    });
  });

  breakdown.push({
    description: `Motorboat rental — ${boat.label}`,
    quantity: 1,
    unit_price: boat.rate,
    subtotal: boat.rate,
  });

  const facilitation = resolveFacilitationFee([boat.id]);

  breakdown.push({
    description: facilitation.label,
    quantity: 1,
    unit_price: facilitation.amount,
    subtotal: facilitation.amount,
  });
  breakdown.push({
    description: 'Garbage fee (refundable)',
    quantity: 1,
    unit_price: ISLAND_HOPPING_RATES.garbageFee,
    subtotal: ISLAND_HOPPING_RATES.garbageFee,
  });

  const total = entranceTotal + boat.rate + facilitation.amount + ISLAND_HOPPING_RATES.garbageFee;

  return {
    total,
    breakdown,
    boat_label: boat.label,
    passenger_count: pax,
    complete: validPassengers.length === passengers.length && passengers.every((p) => {
      const age = parseInt(p.age, 10);
      return (
        p.full_name?.trim() &&
        Number.isFinite(age) &&
        age >= 0 &&
        p.gender &&
        (p.is_first_timer === true || p.is_first_timer === false) &&
        (p.is_pwd === true || p.is_pwd === false)
      );
    }),
  };
}

export function emptyPassenger() {
  return {
    full_name: '',
    age: '',
    gender: '',
    is_first_timer: '',
    is_senior: false,
    senior_id_file: null,
    is_pwd: '',
    pwd_id_file: null,
  };
}

export const emptyIslandHoppingForm = () => ({
  soa_summary: false,
  summary_pax: '',
  summary_amount: '',
  passengers: [emptyPassenger()],
  passenger_address: '',
  payor_name: '',
  payor_address: '',
  payor_phone: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
});

/** Admin manual booking: total from summary mode or computed passenger list. */
export function getAdminIslandHoppingTotal(data) {
  if (!data) return 0;
  if (data.soa_summary) {
    const amount = parseFloat(data.summary_amount);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }
  const quote = calculateIslandHopping(data.passengers);
  if (!quote || quote.error || !quote.complete) return 0;
  return quote.total;
}
