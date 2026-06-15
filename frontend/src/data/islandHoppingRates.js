/** Hundred Islands hopping rates (mirrors backend) */

export const ISLAND_HOPPING_RATES = {
  entrance: {
    infant: { maxAge: 4, label: 'Entrance fee (0–4 years old)', rate: 20 },
    regular: { minAge: 5, maxAge: 59, label: 'Entrance fee (5–59 years old)', rate: 130 },
    senior: { label: 'Senior citizen (with 20% discount)', rate: 108 },
  },
  boat: [
    { id: 'small', label: 'SMALL (1–5 PAX)', min: 1, max: 5, rate: 1600 },
    { id: 'medium', label: 'MEDIUM (6–10 PAX)', min: 6, max: 10, rate: 2000 },
    { id: 'large', label: 'LARGE (11–15 PAX)', min: 11, max: 15, rate: 2400 },
    { id: 'deluxe', label: 'DELUXE (16–20 PAX)', min: 16, max: 20, rate: 2800 },
  ],
  facilitationFee: 300,
  garbageFee: 200,
  maxPassengers: 20,
};

function entranceForPassenger(passenger) {
  const age = parseInt(passenger.age, 10);
  if (!Number.isFinite(age) || age < 0) return null;
  if (age <= ISLAND_HOPPING_RATES.entrance.infant.maxAge) {
    return ISLAND_HOPPING_RATES.entrance.infant;
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
  breakdown.push({
    description: 'Facilitation fee',
    quantity: 1,
    unit_price: ISLAND_HOPPING_RATES.facilitationFee,
    subtotal: ISLAND_HOPPING_RATES.facilitationFee,
  });
  breakdown.push({
    description: 'Garbage fee (refundable)',
    quantity: 1,
    unit_price: ISLAND_HOPPING_RATES.garbageFee,
    subtotal: ISLAND_HOPPING_RATES.garbageFee,
  });

  const total =
    entranceTotal +
    boat.rate +
    ISLAND_HOPPING_RATES.facilitationFee +
    ISLAND_HOPPING_RATES.garbageFee;

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
  passengers: [emptyPassenger()],
  passenger_address: '',
  payor_name: '',
  payor_address: '',
  payor_phone: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
});
