/** Hundred Islands hopping rates & computation */

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
    return { ...ISLAND_HOPPING_RATES.entrance.infant, age };
  }
  if (passenger.is_senior || age >= 60) {
    return { ...ISLAND_HOPPING_RATES.entrance.senior, age };
  }
  return { ...ISLAND_HOPPING_RATES.entrance.regular, age };
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

export function validateIslandHoppingPayload(data) {
  if (!data) return { valid: false, message: 'Island hopping details are required.' };

  const passengers = data.passengers || [];
  if (passengers.length < 1) {
    return { valid: false, message: 'Add at least one island hopping guest.' };
  }
  if (passengers.length > ISLAND_HOPPING_RATES.maxPassengers) {
    return {
      valid: false,
      message: `Maximum ${ISLAND_HOPPING_RATES.maxPassengers} passengers per boat. Contact us for larger groups.`,
    };
  }

  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i];
    if (!p.full_name?.trim()) {
      return { valid: false, message: `Full name is required for guest ${i + 1}.` };
    }
    if (!Number.isFinite(parseInt(p.age, 10)) || parseInt(p.age, 10) < 0) {
      return { valid: false, message: `Valid age is required for ${p.full_name}.` };
    }
    if (!p.gender) return { valid: false, message: `Gender is required for ${p.full_name}.` };
    if (p.is_first_timer !== true && p.is_first_timer !== false) {
      return { valid: false, message: `Please indicate if ${p.full_name} is a first timer.` };
    }
    if (p.is_pwd !== true && p.is_pwd !== false) {
      return { valid: false, message: `Please indicate if ${p.full_name} is a PWD.` };
    }
  }

  if (!data.passenger_address?.trim()) {
    return { valid: false, message: 'Address of passengers is required.' };
  }
  if (!data.payor_name?.trim()) return { valid: false, message: 'Payor name is required.' };
  if (!data.payor_address?.trim()) return { valid: false, message: 'Payor address is required.' };
  if (!data.payor_phone?.trim()) return { valid: false, message: 'Payor cellphone number is required.' };
  if (!data.emergency_contact_name?.trim()) {
    return { valid: false, message: 'Emergency contact name is required.' };
  }
  if (!data.emergency_contact_phone?.trim()) {
    return { valid: false, message: 'Emergency contact cellphone number is required.' };
  }

  return { valid: true };
}

export function calculateIslandHopping(passengers) {
  const pax = passengers?.length || 0;
  if (pax < 1) return { error: 'At least one passenger is required.' };
  if (pax > ISLAND_HOPPING_RATES.maxPassengers) {
    return { error: `Maximum ${ISLAND_HOPPING_RATES.maxPassengers} passengers per boat.` };
  }

  const boat = boatForPax(pax);
  if (!boat) return { error: 'Unable to determine boat size for this group.' };

  const breakdown = [];
  let entranceTotal = 0;

  passengers.forEach((p, index) => {
    const entrance = entranceForPassenger(p);
    if (!entrance) {
      throw new Error(`Invalid age for guest ${index + 1}`);
    }
    entranceTotal += entrance.rate;
    breakdown.push({
      category: 'entrance',
      description: `${entrance.label} — ${p.full_name}`,
      quantity: 1,
      unit_price: entrance.rate,
      subtotal: entrance.rate,
    });
  });

  breakdown.push({
    category: 'boat',
    description: `Motorboat rental — ${boat.label}`,
    quantity: 1,
    unit_price: boat.rate,
    subtotal: boat.rate,
  });

  breakdown.push({
    category: 'fee',
    description: 'Facilitation fee',
    quantity: 1,
    unit_price: ISLAND_HOPPING_RATES.facilitationFee,
    subtotal: ISLAND_HOPPING_RATES.facilitationFee,
  });

  breakdown.push({
    category: 'fee',
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
    total: Math.round(total * 100) / 100,
    breakdown,
    boat_tier: boat.id,
    boat_label: boat.label,
    passenger_count: pax,
    entrance_total: entranceTotal,
    boat_amount: boat.rate,
  };
}
