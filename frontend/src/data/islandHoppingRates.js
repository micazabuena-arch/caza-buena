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
  /** Max guests per single boat — larger groups use multiple boats automatically. */
  maxPassengersPerBoat: 20,
  maxPassengers: 20,
};

const BOAT_TIER_NAMES = { small: 'Small', medium: 'Medium', large: 'Large', deluxe: 'Deluxe' };

/**
 * One flat facilitation fee per tour (not per boat).
 * - 1 standard boat (Small/Medium/Large): ₱300
 * - Deluxe boat OR 2+ boats: ₱500
 */
export function resolveFacilitationFee(boatTierIds, rates = ISLAND_HOPPING_RATES) {
  const ids = (Array.isArray(boatTierIds) ? boatTierIds : [boatTierIds]).filter(Boolean);
  if (ids.length === 0) return { amount: 0, label: 'Facilitation fee' };

  const hasDeluxe = ids.some((id) => id === 'deluxe');
  const multiBoat = ids.length >= 2;

  if (multiBoat || hasDeluxe) {
    if (hasDeluxe && ids.length === 1) {
      return {
        amount: rates.deluxeFacilitationFee,
        label: 'Facilitation fee (Deluxe)',
      };
    }
    if (multiBoat && !hasDeluxe) {
      return {
        amount: rates.deluxeFacilitationFee,
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
    amount: rates.facilitationFee,
    label: size ? `Facilitation fee (${size})` : 'Facilitation fee',
  };
}

/** @deprecated Prefer resolveFacilitationFee — kept for single-boat callers. */
export function getFacilitationFee(boatTierId, rates = ISLAND_HOPPING_RATES) {
  return resolveFacilitationFee([boatTierId], rates).amount;
}

function entranceForPassenger(passenger, rates = ISLAND_HOPPING_RATES) {
  const age = parseInt(passenger.age, 10);
  if (!Number.isFinite(age) || age < 0) return null;
  if (age <= rates.entrance.infant.maxAge) {
    return rates.entrance.infant;
  }
  if (passenger.is_pwd) {
    return rates.entrance.pwd;
  }
  if (passenger.is_senior || age >= 60) {
    return rates.entrance.senior;
  }
  return rates.entrance.regular;
}

function boatForPax(count, rates = ISLAND_HOPPING_RATES) {
  return rates.boat.find((b) => count >= b.min && count <= b.max) || null;
}

/** Split a group into one or more boats (20 pax max per boat). */
export function planBoatsForPax(totalPax, rates = ISLAND_HOPPING_RATES) {
  const pax = parseInt(totalPax, 10);
  if (!Number.isFinite(pax) || pax < 1) return [];

  const maxPerBoat = rates.maxPassengersPerBoat ?? rates.maxPassengers;
  const allocations = [];
  let remaining = pax;

  while (remaining > 0) {
    const chunk = Math.min(remaining, maxPerBoat);
    const boat = boatForPax(chunk, rates);
    if (!boat) return null;
    allocations.push({ boat, pax: chunk });
    remaining -= chunk;
  }

  return allocations;
}

export function formatBoatPlanLabel(allocations) {
  if (!allocations?.length) return '';
  return allocations.map((a) => `${a.boat.label} (${a.pax} pax)`).join(' + ');
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

export function calculateIslandHopping(passengers, rates = ISLAND_HOPPING_RATES) {
  const validPassengers = (passengers || []).filter((p) => p.full_name?.trim());
  const pax = validPassengers.length;
  if (pax < 1) return null;

  const boatAllocations = planBoatsForPax(pax, rates);
  if (!boatAllocations?.length) {
    return { error: 'Unable to determine boat size for this group.' };
  }

  const breakdown = [];
  let entranceTotal = 0;

  validPassengers.forEach((p) => {
    const entrance = entranceForPassenger(p, rates);
    if (!entrance) return;
    entranceTotal += entrance.rate;
    breakdown.push({
      description: `${entrance.label} — ${p.full_name}`,
      quantity: 1,
      unit_price: entrance.rate,
      subtotal: entrance.rate,
    });
  });

  let boatTotal = 0;
  boatAllocations.forEach((allocation) => {
    boatTotal += allocation.boat.rate;
    breakdown.push({
      description:
        boatAllocations.length > 1
          ? `Motorboat rental — ${allocation.boat.label} (${allocation.pax} pax)`
          : `Motorboat rental — ${allocation.boat.label}`,
      quantity: 1,
      unit_price: allocation.boat.rate,
      subtotal: allocation.boat.rate,
    });
  });

  const facilitation = resolveFacilitationFee(boatAllocations.map((a) => a.boat.id), rates);

  breakdown.push({
    description: facilitation.label,
    quantity: 1,
    unit_price: facilitation.amount,
    subtotal: facilitation.amount,
  });

  const garbageTotal = boatAllocations.length * rates.garbageFee;
  breakdown.push({
    description: 'Garbage fee (refundable)',
    quantity: boatAllocations.length,
    unit_price: rates.garbageFee,
    subtotal: garbageTotal,
  });

  const total = entranceTotal + boatTotal + facilitation.amount + garbageTotal;

  return {
    total,
    breakdown,
    boat_label: formatBoatPlanLabel(boatAllocations),
    boat_count: boatAllocations.length,
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
export function getAdminIslandHoppingTotal(data, rates = ISLAND_HOPPING_RATES) {
  if (!data) return 0;
  if (data.soa_summary) {
    const amount = parseFloat(data.summary_amount);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }
  const quote = calculateIslandHopping(data.passengers, rates);
  if (!quote || quote.error || !quote.complete) return 0;
  return quote.total;
}
