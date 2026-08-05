export const PET_DEPOSIT_PER_PET = 500;

export const BILAO_PACKAGES = [
  { id: 'small', label: 'Small', pax: 4, price: 1500 },
  { id: 'medium', label: 'Medium', pax: 7, price: 2000 },
  { id: 'large', label: 'Large', pax: 10, price: 3000 },
  { id: 'xlarge', label: 'X-Large', pax: 15, price: 3500 },
];

export const BOODLE_FIGHT_PACKAGES = [
  { id: '2-5', label: '2–5 pax', price: 5000 },
  { id: '6-8', label: '6–8 pax', price: 6000 },
  { id: '9-11', label: '9–11 pax', price: 6500 },
  { id: '12-15', label: '12–15 pax', price: 7000 },
  { id: '16-20', label: '16–20 pax', price: 11000 },
  { id: '20-25', label: '20–25 pax', price: 13000 },
];

function resolveFoodRates(foodRates) {
  return {
    bilaoPackages: foodRates?.bilaoPackages || BILAO_PACKAGES,
    boodlePackages: foodRates?.boodlePackages || BOODLE_FIGHT_PACKAGES,
    petDepositPerPet: foodRates?.petDepositPerPet ?? PET_DEPOSIT_PER_PET,
  };
}

export function maxPetsForRoomType(roomType) {
  return roomType === 'suite' ? 2 : 1;
}

export function getBilaoPackage(id, bilaoPackages = BILAO_PACKAGES) {
  return bilaoPackages.find((p) => p.id === id) || null;
}

export function getBoodlePackage(id, boodlePackages = BOODLE_FIGHT_PACKAGES) {
  return boodlePackages.find((p) => p.id === id) || null;
}

export function calculatePetDeposit(petCount, petDepositPerPet = PET_DEPOSIT_PER_PET) {
  const count = Math.max(0, parseInt(petCount, 10) || 0);
  return count * petDepositPerPet;
}

export function emptyBilaoQty(bilaoPackages = BILAO_PACKAGES) {
  return Object.fromEntries(bilaoPackages.map((p) => [p.id, 0]));
}

export function emptyBoodleQty(boodlePackages = BOODLE_FIGHT_PACKAGES) {
  return Object.fromEntries(boodlePackages.map((p) => [p.id, 0]));
}

function parseQtyMap(qtyMap, packages) {
  const result = {};
  for (const pkg of packages) {
    const raw = qtyMap?.[pkg.id];
    result[pkg.id] = Math.max(0, parseInt(raw, 10) || 0);
  }
  return result;
}

export function bilaoLinesFromQty(qtyMap, bilaoPackages = BILAO_PACKAGES) {
  return bilaoPackages
    .map((pkg) => ({
      package_id: pkg.id,
      qty: Math.max(0, parseInt(qtyMap?.[pkg.id], 10) || 0),
    }))
    .filter((line) => line.qty > 0);
}

export function boodleLinesFromQty(qtyMap, boodlePackages = BOODLE_FIGHT_PACKAGES) {
  return boodlePackages
    .map((pkg) => ({
      tier_id: pkg.id,
      qty: Math.max(0, parseInt(qtyMap?.[pkg.id], 10) || 0),
    }))
    .filter((line) => line.qty > 0);
}

export function bilaoQtyFromLines(lines, bilaoPackages = BILAO_PACKAGES) {
  const qty = emptyBilaoQty(bilaoPackages);
  for (const line of lines || []) {
    const id = line.package_id || line.packageId;
    if (id && qty[id] !== undefined) {
      qty[id] = Math.max(0, parseInt(line.qty, 10) || 0);
    }
  }
  return qty;
}

export function boodleQtyFromLines(lines, boodlePackages = BOODLE_FIGHT_PACKAGES) {
  const qty = emptyBoodleQty(boodlePackages);
  for (const line of lines || []) {
    const id = line.tier_id || line.tierId;
    if (id && qty[id] !== undefined) {
      qty[id] = Math.max(0, parseInt(line.qty, 10) || 0);
    }
  }
  return qty;
}

export function parseFoodLines(raw) {
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

export function summarizeBilaoLines(lines, bilaoPackages = BILAO_PACKAGES) {
  const items = [];
  let total = 0;
  for (const line of lines || []) {
    const pkg = getBilaoPackage(line.package_id || line.packageId, bilaoPackages);
    const qty = Math.max(0, parseInt(line.qty, 10) || 0);
    if (!pkg || qty < 1) continue;
    const subtotal = pkg.price * qty;
    total += subtotal;
    items.push({ package: pkg, qty, subtotal });
  }
  return {
    items,
    total,
    primaryPackageId: items[0]?.package.id || null,
  };
}

export function summarizeBoodleLines(lines, boodlePackages = BOODLE_FIGHT_PACKAGES) {
  const items = [];
  let total = 0;
  for (const line of lines || []) {
    const pkg = getBoodlePackage(line.tier_id || line.tierId, boodlePackages);
    const qty = Math.max(0, parseInt(line.qty, 10) || 0);
    if (!pkg || qty < 1) continue;
    const subtotal = pkg.price * qty;
    total += subtotal;
    items.push({ package: pkg, qty, subtotal });
  }
  return {
    items,
    total,
    primaryTierId: items[0]?.package.id || null,
  };
}

export function formatBilaoOrderLabel(items) {
  if (!items?.length) return '';
  return items
    .map(({ package: pkg, qty }) => `${qty}× ${pkg.label} bilao`)
    .join(', ');
}

export function formatBoodleOrderLabel(items) {
  if (!items?.length) return '';
  return items
    .map(({ package: pkg, qty }) => `${qty}× Boodle fight (${pkg.label})`)
    .join(', ');
}

export function foodLinesFromBooking(booking, foodRates) {
  const { bilaoPackages, boodlePackages } = resolveFoodRates(foodRates);
  const bilaoStored = parseFoodLines(booking?.bilao_lines);
  const boodleStored = parseFoodLines(booking?.boodle_lines);

  const bilaoLines = bilaoStored.length
    ? bilaoStored
        .map((line) => ({
          package_id: line.package_id || line.packageId,
          qty: Math.max(0, parseInt(line.qty, 10) || 0),
        }))
        .filter((line) => line.package_id && getBilaoPackage(line.package_id, bilaoPackages) && line.qty > 0)
    : booking?.bilao_package && getBilaoPackage(booking.bilao_package, bilaoPackages)
      ? [{ package_id: booking.bilao_package, qty: 1 }]
      : [];

  const boodleLines = boodleStored.length
    ? boodleStored
        .map((line) => ({
          tier_id: line.tier_id || line.tierId,
          qty: Math.max(0, parseInt(line.qty, 10) || 0),
        }))
        .filter((line) => line.tier_id && getBoodlePackage(line.tier_id, boodlePackages) && line.qty > 0)
    : booking?.boodle_fight_tier && getBoodlePackage(booking.boodle_fight_tier, boodlePackages)
      ? [{ tier_id: booking.boodle_fight_tier, qty: 1 }]
      : [];

  return { bilaoLines, boodleLines };
}

export function buildBilaoSoaLineItems(booking, foodRates) {
  const { bilaoPackages } = resolveFoodRates(foodRates);
  const { bilaoLines } = foodLinesFromBooking(booking, foodRates);
  if (bilaoLines.length === 0) {
    if (Number(booking?.bilao_amount) > 0) {
      return [{ label: 'Seafood Bilao', amount: Number(booking.bilao_amount) }];
    }
    return [];
  }

  return summarizeBilaoLines(bilaoLines, bilaoPackages).items.map(({ package: pkg, qty, subtotal }) => ({
    label: qty > 1 ? `Bilao — ${pkg.label} × ${qty}` : `Bilao — ${pkg.label}`,
    amount: subtotal,
  }));
}

export function buildBoodleSoaLineItems(booking, foodRates) {
  const { boodlePackages } = resolveFoodRates(foodRates);
  const { boodleLines } = foodLinesFromBooking(booking, foodRates);
  if (boodleLines.length === 0) {
    if (Number(booking?.boodle_fight_amount) > 0) {
      return [{ label: 'Boodle fight', amount: Number(booking.boodle_fight_amount) }];
    }
    return [];
  }

  return summarizeBoodleLines(boodleLines, boodlePackages).items.map(({ package: pkg, qty, subtotal }) => ({
    label: qty > 1 ? `Boodle fight — ${pkg.label} × ${qty}` : `Boodle fight — ${pkg.label}`,
    amount: subtotal,
  }));
}

export function describeBilaoBooking(booking, foodRates) {
  const { bilaoLines } = foodLinesFromBooking(booking, foodRates);
  if (!bilaoLines.length) return null;
  const { bilaoPackages } = resolveFoodRates(foodRates);
  const summary = summarizeBilaoLines(bilaoLines, bilaoPackages);
  return {
    label: formatBilaoOrderLabel(summary.items),
    amount: summary.total,
  };
}

export function describeBoodleBooking(booking, foodRates) {
  const { boodleLines } = foodLinesFromBooking(booking, foodRates);
  if (!boodleLines.length) return null;
  const { boodlePackages } = resolveFoodRates(foodRates);
  const summary = summarizeBoodleLines(boodleLines, boodlePackages);
  return {
    label: formatBoodleOrderLabel(summary.items),
    amount: summary.total,
  };
}

export function bookingExtrasFromRecord(booking, foodRates) {
  const { bilaoPackages, boodlePackages } = resolveFoodRates(foodRates);
  const bilaoLines = parseFoodLines(booking?.bilao_lines);
  const boodleLines = parseFoodLines(booking?.boodle_lines);
  const bilaoQty =
    bilaoLines.length > 0
      ? bilaoQtyFromLines(bilaoLines, bilaoPackages)
      : booking?.bilao_package
        ? { ...emptyBilaoQty(bilaoPackages), [booking.bilao_package]: 1 }
        : emptyBilaoQty(bilaoPackages);
  const boodleQty =
    boodleLines.length > 0
      ? boodleQtyFromLines(boodleLines, boodlePackages)
      : booking?.boodle_fight_tier
        ? { ...emptyBoodleQty(boodlePackages), [booking.boodle_fight_tier]: 1 }
        : emptyBoodleQty(boodlePackages);

  const bilaoHasQty = Object.values(bilaoQty).some((n) => n > 0);
  const boodleHasQty = Object.values(boodleQty).some((n) => n > 0);

  return {
    bringing_car: Boolean(booking?.bringing_car),
    car_count: booking?.car_count || 1,
    pet_count: booking?.pet_count ?? 0,
    bilao_enabled: bilaoHasQty || Boolean(booking?.bilao_package),
    bilao_package: booking?.bilao_package || '',
    bilao_qty: bilaoQty,
    boodle_fight_enabled: boodleHasQty || Boolean(booking?.boodle_fight_tier),
    boodle_fight_tier: booking?.boodle_fight_tier || '',
    boodle_qty: boodleQty,
  };
}

export function emptyBookingExtras(foodRates) {
  const { bilaoPackages, boodlePackages } = resolveFoodRates(foodRates);
  return {
    bringing_car: false,
    car_count: 1,
    pet_count: 0,
    bilao_enabled: false,
    bilao_package: '',
    bilao_qty: emptyBilaoQty(bilaoPackages),
    boodle_fight_enabled: false,
    boodle_fight_tier: '',
    boodle_qty: emptyBoodleQty(boodlePackages),
  };
}

export function validateBookingExtras(extras, roomType, foodRates) {
  const { bilaoPackages, boodlePackages, petDepositPerPet } = resolveFoodRates(foodRates);

  const bringingCar = Boolean(extras.bringing_car);
  const carCount = bringingCar ? parseInt(extras.car_count, 10) || 0 : 0;
  if (bringingCar && carCount < 1) {
    return { valid: false, message: 'Enter how many cars you are bringing (at least 1).' };
  }

  const petCount = parseInt(extras.pet_count, 10) || 0;
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
          : 'Only 1 small–medium pet is allowed per room. Lower pet count or choose a suite.',
    };
  }

  const bilaoLines = extras.bilao_enabled
    ? bilaoLinesFromQty(parseQtyMap(extras.bilao_qty, bilaoPackages), bilaoPackages)
    : [];
  const boodleLines = extras.boodle_fight_enabled
    ? boodleLinesFromQty(parseQtyMap(extras.boodle_qty, boodlePackages), boodlePackages)
    : [];

  if (extras.bilao_enabled && bilaoLines.length === 0) {
    return { valid: false, message: 'Enter at least one Bilao order quantity.' };
  }
  if (extras.boodle_fight_enabled && boodleLines.length === 0) {
    return { valid: false, message: 'Enter at least one Boodle Fight order quantity.' };
  }

  const bilaoSummary = summarizeBilaoLines(bilaoLines, bilaoPackages);
  const boodleSummary = summarizeBoodleLines(boodleLines, boodlePackages);

  return {
    valid: true,
    bringing_car: bringingCar,
    car_count: carCount,
    pet_count: petCount,
    pet_deposit_amount: calculatePetDeposit(petCount, petDepositPerPet),
    bilao_lines: bilaoLines,
    bilao_package: bilaoSummary.primaryPackageId,
    bilao_amount: bilaoSummary.total,
    bilao_items: bilaoSummary.items,
    boodle_fight: boodleLines.length > 0,
    boodle_lines: boodleLines,
    boodle_fight_tier: boodleSummary.primaryTierId,
    boodle_fight_amount: boodleSummary.total,
    boodle_items: boodleSummary.items,
    add_ons_total: bilaoSummary.total + boodleSummary.total,
  };
}
