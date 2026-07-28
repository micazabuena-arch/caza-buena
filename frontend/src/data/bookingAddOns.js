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

export function maxPetsForRoomType(roomType) {
  return roomType === 'suite' ? 2 : 1;
}

export function getBilaoPackage(id) {
  return BILAO_PACKAGES.find((p) => p.id === id) || null;
}

export function getBoodlePackage(id) {
  return BOODLE_FIGHT_PACKAGES.find((p) => p.id === id) || null;
}

export function calculatePetDeposit(petCount) {
  const count = Math.max(0, parseInt(petCount, 10) || 0);
  return count * PET_DEPOSIT_PER_PET;
}

export function emptyBilaoQty() {
  return Object.fromEntries(BILAO_PACKAGES.map((p) => [p.id, 0]));
}

export function emptyBoodleQty() {
  return Object.fromEntries(BOODLE_FIGHT_PACKAGES.map((p) => [p.id, 0]));
}

function parseQtyMap(qtyMap, packages) {
  const result = {};
  for (const pkg of packages) {
    const raw = qtyMap?.[pkg.id];
    result[pkg.id] = Math.max(0, parseInt(raw, 10) || 0);
  }
  return result;
}

export function bilaoLinesFromQty(qtyMap) {
  return BILAO_PACKAGES.map((pkg) => ({
    package_id: pkg.id,
    qty: Math.max(0, parseInt(qtyMap?.[pkg.id], 10) || 0),
  })).filter((line) => line.qty > 0);
}

export function boodleLinesFromQty(qtyMap) {
  return BOODLE_FIGHT_PACKAGES.map((pkg) => ({
    tier_id: pkg.id,
    qty: Math.max(0, parseInt(qtyMap?.[pkg.id], 10) || 0),
  })).filter((line) => line.qty > 0);
}

export function bilaoQtyFromLines(lines) {
  const qty = emptyBilaoQty();
  for (const line of lines || []) {
    const id = line.package_id || line.packageId;
    if (id && qty[id] !== undefined) {
      qty[id] = Math.max(0, parseInt(line.qty, 10) || 0);
    }
  }
  return qty;
}

export function boodleQtyFromLines(lines) {
  const qty = emptyBoodleQty();
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

export function summarizeBilaoLines(lines) {
  const items = [];
  let total = 0;
  for (const line of lines || []) {
    const pkg = getBilaoPackage(line.package_id || line.packageId);
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

export function summarizeBoodleLines(lines) {
  const items = [];
  let total = 0;
  for (const line of lines || []) {
    const pkg = getBoodlePackage(line.tier_id || line.tierId);
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

export function foodLinesFromBooking(booking) {
  const bilaoStored = parseFoodLines(booking?.bilao_lines);
  const boodleStored = parseFoodLines(booking?.boodle_lines);

  const bilaoLines = bilaoStored.length
    ? bilaoStored
        .map((line) => ({
          package_id: line.package_id || line.packageId,
          qty: Math.max(0, parseInt(line.qty, 10) || 0),
        }))
        .filter((line) => line.package_id && getBilaoPackage(line.package_id) && line.qty > 0)
    : booking?.bilao_package && getBilaoPackage(booking.bilao_package)
      ? [{ package_id: booking.bilao_package, qty: 1 }]
      : [];

  const boodleLines = boodleStored.length
    ? boodleStored
        .map((line) => ({
          tier_id: line.tier_id || line.tierId,
          qty: Math.max(0, parseInt(line.qty, 10) || 0),
        }))
        .filter((line) => line.tier_id && getBoodlePackage(line.tier_id) && line.qty > 0)
    : booking?.boodle_fight_tier && getBoodlePackage(booking.boodle_fight_tier)
      ? [{ tier_id: booking.boodle_fight_tier, qty: 1 }]
      : [];

  return { bilaoLines, boodleLines };
}

export function buildBilaoSoaLineItems(booking) {
  const { bilaoLines } = foodLinesFromBooking(booking);
  if (bilaoLines.length === 0) {
    if (Number(booking?.bilao_amount) > 0) {
      return [{ label: 'Seafood Bilao', amount: Number(booking.bilao_amount) }];
    }
    return [];
  }

  return summarizeBilaoLines(bilaoLines).items.map(({ package: pkg, qty, subtotal }) => ({
    label: qty > 1 ? `Bilao — ${pkg.label} × ${qty}` : `Bilao — ${pkg.label}`,
    amount: subtotal,
  }));
}

export function buildBoodleSoaLineItems(booking) {
  const { boodleLines } = foodLinesFromBooking(booking);
  if (boodleLines.length === 0) {
    if (Number(booking?.boodle_fight_amount) > 0) {
      return [{ label: 'Boodle fight', amount: Number(booking.boodle_fight_amount) }];
    }
    return [];
  }

  return summarizeBoodleLines(boodleLines).items.map(({ package: pkg, qty, subtotal }) => ({
    label: qty > 1 ? `Boodle fight — ${pkg.label} × ${qty}` : `Boodle fight — ${pkg.label}`,
    amount: subtotal,
  }));
}

export function describeBilaoBooking(booking) {
  const { bilaoLines } = foodLinesFromBooking(booking);
  if (!bilaoLines.length) return null;
  const summary = summarizeBilaoLines(bilaoLines);
  return {
    label: formatBilaoOrderLabel(summary.items),
    amount: summary.total,
  };
}

export function describeBoodleBooking(booking) {
  const { boodleLines } = foodLinesFromBooking(booking);
  if (!boodleLines.length) return null;
  const summary = summarizeBoodleLines(boodleLines);
  return {
    label: formatBoodleOrderLabel(summary.items),
    amount: summary.total,
  };
}

export function bookingExtrasFromRecord(booking) {
  const bilaoLines = parseFoodLines(booking?.bilao_lines);
  const boodleLines = parseFoodLines(booking?.boodle_lines);
  const bilaoQty =
    bilaoLines.length > 0
      ? bilaoQtyFromLines(bilaoLines)
      : booking?.bilao_package
        ? { ...emptyBilaoQty(), [booking.bilao_package]: 1 }
        : emptyBilaoQty();
  const boodleQty =
    boodleLines.length > 0
      ? boodleQtyFromLines(boodleLines)
      : booking?.boodle_fight_tier
        ? { ...emptyBoodleQty(), [booking.boodle_fight_tier]: 1 }
        : emptyBoodleQty();

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

export function emptyBookingExtras() {
  return {
    bringing_car: false,
    car_count: 1,
    pet_count: 0,
    bilao_enabled: false,
    bilao_package: '',
    bilao_qty: emptyBilaoQty(),
    boodle_fight_enabled: false,
    boodle_fight_tier: '',
    boodle_qty: emptyBoodleQty(),
  };
}

export function validateBookingExtras(extras, roomType) {
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

  const bilaoLines = extras.bilao_enabled ? bilaoLinesFromQty(parseQtyMap(extras.bilao_qty, BILAO_PACKAGES)) : [];
  const boodleLines = extras.boodle_fight_enabled
    ? boodleLinesFromQty(parseQtyMap(extras.boodle_qty, BOODLE_FIGHT_PACKAGES))
    : [];

  if (extras.bilao_enabled && bilaoLines.length === 0) {
    return { valid: false, message: 'Enter at least one Bilao order quantity.' };
  }
  if (extras.boodle_fight_enabled && boodleLines.length === 0) {
    return { valid: false, message: 'Enter at least one Boodle Fight order quantity.' };
  }

  const bilaoSummary = summarizeBilaoLines(bilaoLines);
  const boodleSummary = summarizeBoodleLines(boodleLines);

  return {
    valid: true,
    bringing_car: bringingCar,
    car_count: carCount,
    pet_count: petCount,
    pet_deposit_amount: calculatePetDeposit(petCount),
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
