/**
 * Caza Buena occupancy rules by room type + optional Admin min/max per unit.
 */

export const EXTRA_PERSON_RATES = {
  adult_weekday: 800,
  adult_weekend: 900,
  child_7_12: 400,
  child_under_6: 0,
};

/** Maximum guests per room type (resort policy) */
export const ROOM_TYPE_CAPACITY = {
  suite: {
    label: 'Suite Room (2 bedrooms)',
    maxTotalGuests: 12,
    defaultIncludedAdults: 8,
    summary:
      '8 adults + 2 children (below 6) + 2 children (7–12), OR 10 adults + 2 children (below 6)',
  },
  queen: {
    label: 'Queen Room (1 bedroom)',
    maxTotalGuests: 5,
    defaultIncludedAdults: 2,
    summary:
      '5 adults, OR 4 adults + 1 child (below 6), OR 4 adults + 1 child (7–12)',
  },
};

/**
 * Adults included in the room rate for this guest mix (by package tier).
 * Suite: 8-adult package OR 9–10 adult package (no 7–12 children).
 * Queen: 4 adults + 1 child OR standard 2 adults.
 */
export function getIncludedAdultsForOccupancy(roomType, { adults, childrenUnder6 = 0, children7_12 = 0 }) {
  const a = Number(adults) || 0;
  const u6 = Number(childrenUnder6) || 0;
  const t712 = Number(children7_12) || 0;

  if (roomType === 'suite') {
    if (a > 8 && t712 === 0) {
      return {
        includedAdults: a,
        packageLabel: `${a}-adult suite rate (add up to 2 children below 6)`,
      };
    }
    return {
      includedAdults: 8,
      packageLabel: '8-adult suite rate (may add children per policy)',
    };
  }

  if ((u6 + t712) >= 1 && a <= 4) {
    return {
      includedAdults: a,
      packageLabel: '4 adults + 1 child queen rate',
    };
  }

  return {
    includedAdults: 2,
    packageLabel: 'Standard queen rate (2 adults in base)',
  };
}

export function totalGuests({ adults, childrenUnder6 = 0, children7_12 = 0 }) {
  return (Number(adults) || 0) + (Number(childrenUnder6) || 0) + (Number(children7_12) || 0);
}

export function resolveRoomType(room) {
  if (room?.room_type === 'suite' || room?.room_type === 'queen') return room.room_type;
  return 'queen';
}

/** Adults included in base rate — Admin → Rooms `included_adults`, else room-type default. */
export function resolveIncludedAdults(room) {
  const fromAdmin = Number(room?.included_adults);
  if (fromAdmin > 0) return fromAdmin;
  const roomType = resolveRoomType(room);
  return ROOM_TYPE_CAPACITY[roomType]?.defaultIncludedAdults ?? 2;
}

/** Guest-facing capacity line from Admin → Rooms min/max (automated per room). */
export function formatRoomCapacitySummary(room) {
  const max = Number(room?.max_guests) || Number(room?.capacity) || 0;
  const min = Number(room?.min_guests) > 0 ? Number(room.min_guests) : 1;
  if (max > 0) {
    if (min > 1) return `${min}–${max} guests for this room.`;
    return `Up to ${max} guests for this room.`;
  }
  const roomType = resolveRoomType(room);
  return ROOM_TYPE_CAPACITY[roomType]?.summary || null;
}

/** Guest-facing starting price — e.g. "Price starts at ₱3,000 / night". */
export function formatRoomPricingSummary(room) {
  const price = Number(room?.price_per_night);
  if (!Number.isFinite(price) || price <= 0) return null;
  return `Price starts at ₱${price.toLocaleString()} / night`;
}

/** True when this room has an admin-configured guest cap (max_guests or capacity). */
export function hasAdminGuestCap(room) {
  const max = Number(room?.max_guests) || Number(room?.capacity) || 0;
  return max > 0;
}

/** Suite maximum combinations */
export function validateSuiteOccupancy(adults, childrenUnder6, children7_12) {
  const a = Number(adults) || 0;
  const u6 = Number(childrenUnder6) || 0;
  const t712 = Number(children7_12) || 0;

  if (a > 10 || u6 > 2 || t712 > 2) {
    return {
      valid: false,
      message:
        'Suite allows up to 8 adults + 2 children (below 6) + 2 children (7–12), OR 10 adults + 2 children (below 6).',
    };
  }
  if (a > 8 && t712 > 0) {
    return {
      valid: false,
      message:
        'Children aged 7–12 are only allowed with up to 8 adults in a Suite. For 9–10 adults, only children below 6 may be added.',
    };
  }
  if (a <= 8 && u6 <= 2 && t712 <= 2) return { valid: true };
  if (a <= 10 && u6 <= 2 && t712 === 0) return { valid: true };
  return {
    valid: false,
    message:
      'Suite allows up to 8 adults + 2 children (below 6) + 2 children (7–12), OR 10 adults + 2 children (below 6).',
  };
}

/** Queen maximum combinations */
export function validateQueenOccupancy(adults, childrenUnder6, children7_12) {
  const a = Number(adults) || 0;
  const u6 = Number(childrenUnder6) || 0;
  const t712 = Number(children7_12) || 0;

  if (u6 > 1 || t712 > 1 || (u6 > 0 && t712 > 0)) {
    return {
      valid: false,
      message:
        'Queen room allows up to 5 adults, OR 4 adults + 1 child (below 6), OR 4 adults + 1 child (7–12).',
    };
  }
  if (a > 5) {
    return {
      valid: false,
      message: 'Queen room allows a maximum of 5 adults without children.',
    };
  }
  if (u6 + t712 === 1 && a > 4) {
    return {
      valid: false,
      message: 'With one child, Queen rooms allow a maximum of 4 adults.',
    };
  }
  return { valid: true };
}

export function validateRoomTypeOccupancy(roomType, occupancy) {
  const { adults, childrenUnder6 = 0, children7_12 = 0 } = occupancy;
  if (roomType === 'suite') {
    return validateSuiteOccupancy(adults, childrenUnder6, children7_12);
  }
  return validateQueenOccupancy(adults, childrenUnder6, children7_12);
}

export function getRoomLimits(room) {
  const roomType = resolveRoomType(room);
  const typeCap = ROOM_TYPE_CAPACITY[roomType] || ROOM_TYPE_CAPACITY.queen;
  const adminMax = Number(room.max_guests) || Number(room.capacity) || 0;
  const adminMin = Number(room.min_guests) > 0 ? Number(room.min_guests) : 1;

  const policyMax = typeCap.maxTotalGuests;
  const maxGuests = adminMax > 0 ? Math.min(adminMax, policyMax) : policyMax;
  const capacitySummary = formatRoomCapacitySummary(room) || typeCap.summary;

  const includedAdults = resolveIncludedAdults(room);

  return {
    minGuests: adminMin,
    maxGuests,
    adminMax: adminMax > 0 ? adminMax : null,
    adminMin,
    policyMax,
    includedAdults,
    roomType,
    capacitySummary,
    pricingSummary: formatRoomPricingSummary(room),
    capacityLabel: typeCap.label,
  };
}

/** Included adults for pricing — admin cap uses DB value; else package-tier logic. */
export function getIncludedAdultsForRoom(room, occupancy) {
  if (hasAdminGuestCap(room)) {
    const includedAdults = resolveIncludedAdults(room);
    return {
      includedAdults,
      packageLabel: `Base rate includes ${includedAdults} adult${includedAdults !== 1 ? 's' : ''}`,
    };
  }
  return getIncludedAdultsForOccupancy(resolveRoomType(room), occupancy);
}

/**
 * Validate booking occupancy.
 * When Admin → Rooms has min/max set, that headcount is the only guest limit for that room.
 */
export function validateOccupancy(room, { adults, childrenUnder6 = 0, children7_12 = 0 }) {
  const a = Number(adults) || 0;
  const u6 = Number(childrenUnder6) || 0;
  const t712 = Number(children7_12) || 0;

  if (a < 1) return { valid: false, message: 'At least one adult is required.' };

  const total = totalGuests({ adults: a, childrenUnder6: u6, children7_12: t712 });
  const limits = getRoomLimits(room);
  const prefix = room.name ? `${room.name}: ` : '';
  const adminMax = Number(room.max_guests) || Number(room.capacity) || 0;
  const adminMin = limits.adminMin;

  if (hasAdminGuestCap(room)) {
    if (total < adminMin) {
      return {
        valid: false,
        message: `${prefix}requires at least ${adminMin} guest(s). You selected ${total}.`,
      };
    }
    if (total > adminMax) {
      return {
        valid: false,
        message: `${prefix}allows up to ${adminMax} guest(s). You selected ${total}.`,
      };
    }
    return {
      valid: true,
      roomType: limits.roomType,
      capacitySummary: limits.capacitySummary,
    };
  }

  const roomType = resolveRoomType(room);
  const typeCheck = validateRoomTypeOccupancy(roomType, {
    adults: a,
    childrenUnder6: u6,
    children7_12: t712,
  });
  if (!typeCheck.valid) return typeCheck;

  if (total < limits.minGuests) {
    return {
      valid: false,
      message: `${prefix}requires at least ${limits.minGuests} guest(s). You selected ${total}.`,
    };
  }

  if (total > limits.maxGuests) {
    return {
      valid: false,
      message: `${prefix}allows up to ${limits.maxGuests} guest(s). You selected ${total}.`,
    };
  }

  return { valid: true, roomType, capacitySummary: limits.capacitySummary };
}

/**
 * Extra person fees when guests exceed the adults included in their package tier:
 * - Extra adult: ₱800/night (weekday) or ₱900/night (weekend)
 * - Child 7–12: ₱400/night · Child 6 & below: free
 */
export function calculateExtraPersonCharges(
  room,
  { adults, childrenUnder6 = 0, children7_12 = 0 },
  rates = EXTRA_PERSON_RATES
) {
  const limits = getRoomLimits(room);
  const a = Number(adults) || 0;
  const u6 = Number(childrenUnder6) || 0;
  const t712 = Number(children7_12) || 0;

  const { includedAdults, packageLabel } = getIncludedAdultsForRoom(room, {
    adults: a,
    childrenUnder6: u6,
    children7_12: t712,
  });

  const extraAdults = Math.max(0, a - includedAdults);
  const adultWeekdayRate = rates.adult_weekday;
  const adultWeekendRate = rates.adult_weekend;
  const childRate = rates.child_7_12;
  const nightlyAdultWeekday = extraAdults * adultWeekdayRate;
  const nightlyAdultWeekend = extraAdults * adultWeekendRate;
  const nightlyChild = t712 * childRate;

  return {
    ...limits,
    includedAdults,
    packageLabel,
    extraAdults,
    extraChildren7_12: t712,
    extraChildrenUnder6: u6,
    children7_12: t712,
    childrenUnder6: u6,
    adultWeekdayRate,
    adultWeekendRate,
    childRate,
    nightlyAdultWeekday,
    nightlyAdultWeekend,
    nightlyChild,
    nightlyExtraWeekday: nightlyAdultWeekday + nightlyChild,
    nightlyExtraWeekend: nightlyAdultWeekend + nightlyChild,
    nightlyExtra: nightlyAdultWeekday + nightlyChild,
    total: nightlyAdultWeekday + nightlyChild,
    note:
      extraAdults === 0 && nightlyChild === 0
        ? 'All guests are covered by the room rate for this package.'
        : null,
  };
}
