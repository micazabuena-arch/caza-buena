const PET_DEPOSIT_PER_PET = 500;

export const BILAO_PACKAGES = {
  small: { label: 'Small', pax: 4, price: 1500 },
  medium: { label: 'Medium', pax: 7, price: 2000 },
  large: { label: 'Large', pax: 10, price: 3000 },
  xlarge: { label: 'X-Large', pax: 15, price: 3500 },
};

export const BOODLE_FIGHT_PACKAGES = {
  '2-5': { label: '2–5 pax', price: 5000 },
  '6-8': { label: '6–8 pax', price: 6000 },
  '9-11': { label: '9–11 pax', price: 6500 },
  '12-15': { label: '12–15 pax', price: 7000 },
  '16-20': { label: '16–20 pax', price: 11000 },
  '20-25': { label: '20–25 pax', price: 13000 },
};

export function maxPetsForRoomType(roomType) {
  return roomType === 'suite' ? 2 : 1;
}

export function validateBookingExtras(payload, roomType) {
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

  let bilaoPackage = null;
  let bilaoAmount = 0;
  if (payload?.bilao_enabled) {
    bilaoPackage = BILAO_PACKAGES[payload.bilao_package];
    if (!bilaoPackage) {
      return { valid: false, message: 'Select a Bilao food package size.' };
    }
    bilaoAmount = bilaoPackage.price;
  }

  let boodleTier = null;
  let boodleAmount = 0;
  if (payload?.boodle_fight_enabled) {
    boodleTier = BOODLE_FIGHT_PACKAGES[payload.boodle_fight_tier];
    if (!boodleTier) {
      return { valid: false, message: 'Select a Boodle Fight group size.' };
    }
    boodleAmount = boodleTier.price;
  }

  return {
    valid: true,
    bringing_car: bringingCar,
    car_count: carCount,
    pet_count: petCount,
    pet_deposit_amount: petCount * PET_DEPOSIT_PER_PET,
    bilao_package: bilaoPackage ? payload.bilao_package : null,
    bilao_amount: bilaoAmount,
    boodle_fight: Boolean(payload?.boodle_fight_enabled),
    boodle_fight_tier: boodleTier ? payload.boodle_fight_tier : null,
    boodle_fight_amount: boodleAmount,
    add_ons_total: bilaoAmount + boodleAmount,
  };
}
