/** Hundred Islands hopping rates & computation */

import { DEFAULT_ISLAND_HOPPING_RATES } from './islandHoppingRatesStore.js';

export const ISLAND_HOPPING_RATES = DEFAULT_ISLAND_HOPPING_RATES;

const BOAT_TIER_NAMES = { small: 'Small', medium: 'Medium', large: 'Large', deluxe: 'Deluxe' };

/**
 * One flat facilitation fee per tour (not per boat).
 * - 1 standard boat (Small/Medium/Large): standard fee
 * - Deluxe boat OR 2+ boats: deluxe fee
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
      amount: rates.deluxeFacilitationFee,
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
    return { ...rates.entrance.infant, age };
  }
  if (passenger.is_pwd) {
    return { ...rates.entrance.pwd, age };
  }
  if (passenger.is_senior || age >= 60) {
    return { ...rates.entrance.senior, age };
  }
  return { ...rates.entrance.regular, age };
}

function boatForPax(count, rates = ISLAND_HOPPING_RATES) {
  return rates.boat.find((b) => count >= b.min && count <= b.max) || null;
}

function planBoatsForPax(totalPax, rates = ISLAND_HOPPING_RATES) {
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

function formatBoatPlanLabel(allocations) {
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

export function validateIslandHoppingPayload(data) {
  if (!data) return { valid: false, message: 'Island hopping details are required.' };

  const passengers = data.passengers || [];
  if (passengers.length < 1) {
    return { valid: false, message: 'Add at least one island hopping guest.' };
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

export function validateIslandHoppingPayloadLenient(data) {
  if (!data) return { valid: true };

  if (data.soa_summary) {
    const pax = parseInt(data.summary_pax, 10);
    if (!Number.isFinite(pax) || pax < 1) {
      return { valid: false, message: 'Enter the number of island hopping passengers.' };
    }
    const amount = parseFloat(data.summary_amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return { valid: false, message: 'Enter a valid island hopping amount.' };
    }
    return { valid: true };
  }

  return { valid: true };
}

export function isIslandHoppingComplete(data) {
  return validateIslandHoppingPayload(data).valid;
}

export function calculateIslandHopping(passengers, rates = ISLAND_HOPPING_RATES) {
  const pax = passengers?.length || 0;
  if (pax < 1) return { error: 'At least one passenger is required.' };

  const boatAllocations = planBoatsForPax(pax, rates);
  if (!boatAllocations?.length) {
    return { error: 'Unable to determine boat size for this group.' };
  }

  const breakdown = [];
  let entranceTotal = 0;

  passengers.forEach((p, index) => {
    const entrance = entranceForPassenger(p, rates);
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

  let boatTotal = 0;
  boatAllocations.forEach((allocation) => {
    boatTotal += allocation.boat.rate;
    breakdown.push({
      category: 'boat',
      description:
        boatAllocations.length > 1
          ? `Motorboat rental — ${allocation.boat.label} (${allocation.pax} pax)`
          : `Motorboat rental — ${allocation.boat.label}`,
      quantity: 1,
      unit_price: allocation.boat.rate,
      subtotal: allocation.boat.rate,
    });
  });

  const facilitation = resolveFacilitationFee(
    boatAllocations.map((a) => a.boat.id),
    rates
  );

  breakdown.push({
    category: 'fee',
    description: facilitation.label,
    quantity: 1,
    unit_price: facilitation.amount,
    subtotal: facilitation.amount,
  });

  const garbageTotal = boatAllocations.length * rates.garbageFee;
  breakdown.push({
    category: 'fee',
    description: 'Garbage fee (refundable)',
    quantity: boatAllocations.length,
    unit_price: rates.garbageFee,
    subtotal: garbageTotal,
  });

  const total = entranceTotal + boatTotal + facilitation.amount + garbageTotal;

  return {
    total: Math.round(total * 100) / 100,
    breakdown,
    boat_tier: boatAllocations[0].boat.id,
    boat_label: formatBoatPlanLabel(boatAllocations),
    boat_count: boatAllocations.length,
    passenger_count: pax,
    entrance_total: entranceTotal,
    boat_amount: boatTotal,
  };
}

export function resolveAdminIslandHoppingPricing(
  ihData,
  existingIsland = null,
  rates = ISLAND_HOPPING_RATES
) {
  if (!ihData) return { amount: 0, stored: null };

  const validation = validateIslandHoppingPayloadLenient(ihData);
  if (!validation.valid) return { error: validation.message };

  const trim = (v) => (v == null ? '' : String(v).trim());

  if (ihData.soa_summary) {
    const pax = parseInt(ihData.summary_pax, 10);
    const amount = Math.round(parseFloat(ihData.summary_amount) * 100) / 100;
    const quotedBoats = Array.isArray(ihData.summary_boats)
      ? ihData.summary_boats.filter((boat) => boat && (boat.label || boat.id))
      : [];
    const boatAllocations = quotedBoats.length ? null : planBoatsForPax(pax, rates);
    const boatPlan =
      quotedBoats.length > 0
        ? quotedBoats
            .map((boat) => {
              const label = boat.label || boat.id || 'Boat';
              const rate = Number(boat.rate);
              return Number.isFinite(rate) && rate > 0
                ? `${label} — ₱${rate.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
                : label;
            })
            .join(' + ')
        : formatBoatPlanLabel(boatAllocations);
    return {
      amount,
      stored: {
        soa_summary: true,
        summary_pax: pax,
        summary_amount: amount,
        summary_boats: quotedBoats,
        total: amount,
        passenger_count: pax,
        boat_plan: boatPlan,
        boat_count: quotedBoats.length || boatAllocations?.length || 0,
        passengers: [],
        passenger_address: '',
        payor_name: '',
        payor_address: '',
        payor_phone: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
      },
    };
  }

  const passengers = (ihData.passengers || []).map((p, i) => ({
    ...p,
    senior_id_url: existingIsland?.passengers?.[i]?.senior_id_url ?? p.senior_id_url ?? null,
    senior_id_public_id:
      existingIsland?.passengers?.[i]?.senior_id_public_id ?? p.senior_id_public_id ?? null,
    pwd_id_url: existingIsland?.passengers?.[i]?.pwd_id_url ?? p.pwd_id_url ?? null,
    pwd_id_public_id:
      existingIsland?.passengers?.[i]?.pwd_id_public_id ?? p.pwd_id_public_id ?? null,
  }));

  const baseStored = {
    soa_summary: false,
    passengers,
    passenger_address: trim(ihData.passenger_address),
    payor_name: trim(ihData.payor_name),
    payor_address: trim(ihData.payor_address),
    payor_phone: trim(ihData.payor_phone),
    emergency_contact_name: trim(ihData.emergency_contact_name),
    emergency_contact_phone: trim(ihData.emergency_contact_phone),
  };

  if (isIslandHoppingComplete(ihData)) {
    try {
      const computed = calculateIslandHopping(ihData.passengers, rates);
      if (computed.error) return { error: computed.error };
      return {
        amount: computed.total,
        stored: {
          ...baseStored,
          breakdown: computed.breakdown,
          boat_tier: computed.boat_tier,
          boat_label: computed.boat_label,
          total: computed.total,
          passenger_count: computed.passenger_count,
        },
      };
    } catch (e) {
      return { error: e.message || 'Invalid island hopping details' };
    }
  }

  return { amount: 0, stored: baseStored };
}
