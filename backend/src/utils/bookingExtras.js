import {
  DEFAULT_FOOD_ADD_ON_RATES,
  packageMapsFromRates,
} from './foodAddOnRatesStore.js';

const DEFAULT_MAPS = packageMapsFromRates(DEFAULT_FOOD_ADD_ON_RATES);

/** @deprecated Use getFoodAddOnRates() — kept for backwards compatibility. */
export const BILAO_PACKAGES = DEFAULT_MAPS.bilao;

/** @deprecated Use getFoodAddOnRates() — kept for backwards compatibility. */
export const BOODLE_FIGHT_PACKAGES = DEFAULT_MAPS.boodle;

export function maxPetsForRoomType(roomType) {
  return roomType === 'suite' ? 2 : 1;
}

function resolveMaps(foodRates) {
  if (!foodRates) return DEFAULT_MAPS;
  return {
    bilao: foodRates.bilao || DEFAULT_MAPS.bilao,
    boodle: foodRates.boodle || DEFAULT_MAPS.boodle,
    petDepositPerPet: foodRates.petDepositPerPet ?? DEFAULT_MAPS.petDepositPerPet,
  };
}

function parseFoodLines(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeBilaoLines(payload, bilaoPackages) {
  const fromLines = parseFoodLines(payload?.bilao_lines).filter(
    (line) => line?.package_id && bilaoPackages[line.package_id]
  );
  if (fromLines.length) {
    return fromLines
      .map((line) => ({
        package_id: line.package_id,
        qty: Math.max(0, parseInt(line.qty, 10) || 0),
      }))
      .filter((line) => line.qty > 0);
  }

  if (payload?.bilao_enabled && payload?.bilao_package && bilaoPackages[payload.bilao_package]) {
    return [{ package_id: payload.bilao_package, qty: 1 }];
  }

  return [];
}

function normalizeBoodleLines(payload, boodlePackages) {
  const fromLines = parseFoodLines(payload?.boodle_lines).filter(
    (line) => line?.tier_id && boodlePackages[line.tier_id]
  );
  if (fromLines.length) {
    return fromLines
      .map((line) => ({
        tier_id: line.tier_id,
        qty: Math.max(0, parseInt(line.qty, 10) || 0),
      }))
      .filter((line) => line.qty > 0);
  }

  if (
    payload?.boodle_fight_enabled &&
    payload?.boodle_fight_tier &&
    boodlePackages[payload.boodle_fight_tier]
  ) {
    return [{ tier_id: payload.boodle_fight_tier, qty: 1 }];
  }

  return [];
}

function summarizeBilaoLines(lines, bilaoPackages) {
  let total = 0;
  for (const line of lines) {
    const pkg = bilaoPackages[line.package_id];
    total += pkg.price * line.qty;
  }
  return {
    total,
    primaryPackageId: lines[0]?.package_id || null,
  };
}

function summarizeBoodleLines(lines, boodlePackages) {
  let total = 0;
  for (const line of lines) {
    const pkg = boodlePackages[line.tier_id];
    total += pkg.price * line.qty;
  }
  return {
    total,
    primaryTierId: lines[0]?.tier_id || null,
  };
}

export function validateBookingExtras(payload, roomType, foodRates) {
  const { bilao: bilaoPackages, boodle: boodlePackages, petDepositPerPet } = resolveMaps(foodRates);

  const bringingCar = Boolean(payload?.bringing_car);
  const carCount = bringingCar ? parseInt(payload?.car_count, 10) || 0 : 0;
  if (bringingCar && carCount < 1) {
    return { valid: false, message: 'Enter how many cars you are bringing (at least 1).' };
  }

  const petCount = parseInt(payload?.pet_count, 10) || 0;
  const maxPets = maxPetsForRoomType(roomType);
  if (petCount < 0) {
    return { valid: false, message: 'Pet count cannot be negative.' };
  }
  if (petCount > maxPets) {
    return {
      valid: false,
      message:
        roomType === 'suite'
          ? 'Suites allow up to 2 small–medium pets. Queen rooms allow 1 pet.'
          : 'Only 1 small–medium pet is allowed per room.',
    };
  }

  const bilaoLines = payload?.bilao_enabled ? normalizeBilaoLines(payload, bilaoPackages) : [];
  const boodleLines = payload?.boodle_fight_enabled
    ? normalizeBoodleLines(payload, boodlePackages)
    : [];

  if (payload?.bilao_enabled && bilaoLines.length === 0) {
    return { valid: false, message: 'Enter at least one Bilao order quantity.' };
  }
  if (payload?.boodle_fight_enabled && boodleLines.length === 0) {
    return { valid: false, message: 'Enter at least one Boodle Fight order quantity.' };
  }

  const bilaoSummary = summarizeBilaoLines(bilaoLines, bilaoPackages);
  const boodleSummary = summarizeBoodleLines(boodleLines, boodlePackages);

  return {
    valid: true,
    bringing_car: bringingCar,
    car_count: carCount,
    pet_count: petCount,
    pet_deposit_amount: petCount * petDepositPerPet,
    bilao_lines: bilaoLines,
    bilao_package: bilaoSummary.primaryPackageId,
    bilao_amount: bilaoSummary.total,
    boodle_fight: boodleLines.length > 0,
    boodle_lines: boodleLines,
    boodle_fight_tier: boodleSummary.primaryTierId,
    boodle_fight_amount: boodleSummary.total,
    add_ons_total: bilaoSummary.total + boodleSummary.total,
  };
}

export function serializeFoodLines(lines) {
  if (!lines?.length) return null;
  return JSON.stringify(lines);
}

/** Read stored bilao/boodle line items, falling back to legacy single-package fields. */
export function foodLinesFromBooking(booking, foodRates) {
  const { bilao: bilaoPackages, boodle: boodlePackages } = resolveMaps(foodRates);
  const bilaoStored = parseFoodLines(booking?.bilao_lines);
  const boodleStored = parseFoodLines(booking?.boodle_lines);

  const bilaoLines = bilaoStored.length
    ? bilaoStored
        .map((line) => ({
          package_id: line.package_id,
          qty: Math.max(0, parseInt(line.qty, 10) || 0),
        }))
        .filter((line) => line.package_id && bilaoPackages[line.package_id] && line.qty > 0)
    : booking?.bilao_package && bilaoPackages[booking.bilao_package]
      ? [{ package_id: booking.bilao_package, qty: 1 }]
      : [];

  const boodleLines = boodleStored.length
    ? boodleStored
        .map((line) => ({
          tier_id: line.tier_id,
          qty: Math.max(0, parseInt(line.qty, 10) || 0),
        }))
        .filter((line) => line.tier_id && boodlePackages[line.tier_id] && line.qty > 0)
    : booking?.boodle_fight_tier && boodlePackages[booking.boodle_fight_tier]
      ? [{ tier_id: booking.boodle_fight_tier, qty: 1 }]
      : [];

  return { bilaoLines, boodleLines };
}

/** Itemized SOA lines for bilao orders. */
export function buildBilaoSoaLineItems(booking, foodRates) {
  const { bilao: bilaoPackages } = resolveMaps(foodRates);
  const { bilaoLines } = foodLinesFromBooking(booking, foodRates);
  if (bilaoLines.length === 0) {
    if (Number(booking?.bilao_amount) > 0) {
      return [{ label: 'Seafood Bilao', amount: Number(booking.bilao_amount) }];
    }
    return [];
  }

  return bilaoLines.map((line) => {
    const pkg = bilaoPackages[line.package_id];
    const qtyLabel = line.qty > 1 ? ` × ${line.qty}` : '';
    return {
      label: `Bilao — ${pkg.label}${qtyLabel}`,
      amount: pkg.price * line.qty,
    };
  });
}

/** Itemized SOA lines for boodle fight orders. */
export function buildBoodleSoaLineItems(booking, foodRates) {
  const { boodle: boodlePackages } = resolveMaps(foodRates);
  const { boodleLines } = foodLinesFromBooking(booking, foodRates);
  if (boodleLines.length === 0) {
    if (Number(booking?.boodle_fight_amount) > 0) {
      return [{ label: 'Boodle fight', amount: Number(booking.boodle_fight_amount) }];
    }
    return [];
  }

  return boodleLines.map((line) => {
    const pkg = boodlePackages[line.tier_id];
    const qtyLabel = line.qty > 1 ? ` × ${line.qty}` : '';
    return {
      label: `Boodle fight — ${pkg.label}${qtyLabel}`,
      amount: pkg.price * line.qty,
    };
  });
}
