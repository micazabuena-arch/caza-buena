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

export function emptyBookingExtras() {
  return {
    bringing_car: false,
    car_count: 1,
    pet_count: 0,
    bilao_enabled: false,
    bilao_package: '',
    boodle_fight_enabled: false,
    boodle_fight_tier: '',
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
    const roomLabel = roomType === 'suite' ? 'suites' : 'this room';
    return {
      valid: false,
      message:
        roomType === 'suite'
          ? 'Suites allow up to 2 small–medium pets. Queen rooms allow 1 pet.'
          : `Only 1 small–medium pet is allowed per room. Lower pet count or choose a suite.`,
    };
  }

  let bilaoAmount = 0;
  let bilaoPackage = null;
  if (extras.bilao_enabled) {
    bilaoPackage = getBilaoPackage(extras.bilao_package);
    if (!bilaoPackage) {
      return { valid: false, message: 'Select a Bilao food package size.' };
    }
    bilaoAmount = bilaoPackage.price;
  }

  let boodleAmount = 0;
  let boodlePackage = null;
  if (extras.boodle_fight_enabled) {
    boodlePackage = getBoodlePackage(extras.boodle_fight_tier);
    if (!boodlePackage) {
      return { valid: false, message: 'Select a Boodle Fight group size.' };
    }
    boodleAmount = boodlePackage.price;
  }

  return {
    valid: true,
    bringing_car: bringingCar,
    car_count: carCount,
    pet_count: petCount,
    pet_deposit_amount: calculatePetDeposit(petCount),
    bilao_package: bilaoPackage?.id || null,
    bilao_amount: bilaoAmount,
    boodle_fight: Boolean(extras.boodle_fight_enabled),
    boodle_fight_tier: boodlePackage?.id || null,
    boodle_fight_amount: boodleAmount,
    add_ons_total: bilaoAmount + boodleAmount,
  };
}
