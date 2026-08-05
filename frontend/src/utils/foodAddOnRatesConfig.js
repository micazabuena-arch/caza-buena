import {
  BILAO_PACKAGES,
  BOODLE_FIGHT_PACKAGES,
  PET_DEPOSIT_PER_PET,
} from '../data/bookingAddOns';

export const FOOD_ADD_ON_RATES_SETTING_KEY = 'food_add_on_rates';

function parseMoney(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseIntSafe(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Merge API / saved settings with built-in defaults. */
export function resolveFoodAddOnRates(fromApi) {
  if (!fromApi || typeof fromApi !== 'object') {
    return defaultFoodAddOnRates();
  }

  const bilaoPackages = BILAO_PACKAGES.map((pkg) => {
    const saved = fromApi.bilao?.find((row) => row.id === pkg.id);
    if (!saved) return { ...pkg };
    return {
      ...pkg,
      label: saved.label || pkg.label,
      pax: parseIntSafe(saved.pax, pkg.pax),
      price: parseMoney(saved.price, pkg.price),
    };
  });

  const boodlePackages = BOODLE_FIGHT_PACKAGES.map((pkg) => {
    const saved = fromApi.boodle?.find((row) => row.id === pkg.id);
    if (!saved) return { ...pkg };
    return {
      ...pkg,
      label: saved.label || pkg.label,
      price: parseMoney(saved.price, pkg.price),
    };
  });

  return {
    bilaoPackages,
    boodlePackages,
    petDepositPerPet: parseMoney(fromApi.petDepositPerPet, PET_DEPOSIT_PER_PET),
  };
}

export function defaultFoodAddOnRates() {
  return {
    bilaoPackages: BILAO_PACKAGES.map((pkg) => ({ ...pkg })),
    boodlePackages: BOODLE_FIGHT_PACKAGES.map((pkg) => ({ ...pkg })),
    petDepositPerPet: PET_DEPOSIT_PER_PET,
  };
}

/** Build editable form state (arrays) from resolved rates. */
export function foodAddOnRatesFormState(rates = defaultFoodAddOnRates()) {
  return {
    bilao: rates.bilaoPackages.map((pkg) => ({ ...pkg })),
    boodle: rates.boodlePackages.map((pkg) => ({ ...pkg })),
    petDepositPerPet: rates.petDepositPerPet,
  };
}

export function foodAddOnRatesFromSettings(settings = {}) {
  if (settings.food_add_on_rates) {
    return resolveFoodAddOnRates(settings.food_add_on_rates);
  }
  if (settings[FOOD_ADD_ON_RATES_SETTING_KEY]) {
    try {
      const parsed =
        typeof settings[FOOD_ADD_ON_RATES_SETTING_KEY] === 'string'
          ? JSON.parse(settings[FOOD_ADD_ON_RATES_SETTING_KEY])
          : settings[FOOD_ADD_ON_RATES_SETTING_KEY];
      return resolveFoodAddOnRates(parsed);
    } catch {
      return defaultFoodAddOnRates();
    }
  }
  return defaultFoodAddOnRates();
}

/** Serialize form arrays back to API payload shape. */
export function foodAddOnRatesToPayload(form) {
  return {
    bilao: form.bilao.map((pkg) => ({
      id: pkg.id,
      label: pkg.label,
      pax: parseIntSafe(pkg.pax, 1),
      price: parseMoney(pkg.price, 0),
    })),
    boodle: form.boodle.map((pkg) => ({
      id: pkg.id,
      label: pkg.label,
      price: parseMoney(pkg.price, 0),
    })),
    petDepositPerPet: parseMoney(form.petDepositPerPet, PET_DEPOSIT_PER_PET),
  };
}
