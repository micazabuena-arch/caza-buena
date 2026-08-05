import pool from '../config/database.js';

export const FOOD_ADD_ON_RATES_SETTING_KEY = 'food_add_on_rates';

/** Default seafood bilao, boodle fight, and pet deposit rates. */
export const DEFAULT_FOOD_ADD_ON_RATES = {
  bilao: [
    { id: 'small', label: 'Small', pax: 4, price: 1500 },
    { id: 'medium', label: 'Medium', pax: 7, price: 2000 },
    { id: 'large', label: 'Large', pax: 10, price: 3000 },
    { id: 'xlarge', label: 'X-Large', pax: 15, price: 3500 },
  ],
  boodle: [
    { id: '2-5', label: '2–5 pax', price: 5000 },
    { id: '6-8', label: '6–8 pax', price: 6000 },
    { id: '9-11', label: '9–11 pax', price: 6500 },
    { id: '12-15', label: '12–15 pax', price: 7000 },
    { id: '16-20', label: '16–20 pax', price: 11000 },
    { id: '20-25', label: '20–25 pax', price: 13000 },
  ],
  petDepositPerPet: 500,
};

function parseMoney(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseIntSafe(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function mergeRates(parsed) {
  const base = structuredClone(DEFAULT_FOOD_ADD_ON_RATES);
  if (!parsed || typeof parsed !== 'object') return base;

  if (Array.isArray(parsed.bilao)) {
    base.bilao = base.bilao.map((pkg) => {
      const saved = parsed.bilao.find((row) => row.id === pkg.id);
      if (!saved) return pkg;
      return {
        ...pkg,
        label: saved.label || pkg.label,
        pax: parseIntSafe(saved.pax, pkg.pax),
        price: parseMoney(saved.price, pkg.price),
      };
    });
  }

  if (Array.isArray(parsed.boodle)) {
    base.boodle = base.boodle.map((pkg) => {
      const saved = parsed.boodle.find((row) => row.id === pkg.id);
      if (!saved) return pkg;
      return {
        ...pkg,
        label: saved.label || pkg.label,
        price: parseMoney(saved.price, pkg.price),
      };
    });
  }

  base.petDepositPerPet = parseMoney(parsed.petDepositPerPet, base.petDepositPerPet);

  return base;
}

/** Convert array packages to lookup maps used by bookingExtras. */
export function packageMapsFromRates(rates) {
  const bilao = Object.fromEntries(
    (rates.bilao || []).map((pkg) => [
      pkg.id,
      { label: pkg.label, pax: pkg.pax, price: pkg.price },
    ])
  );
  const boodle = Object.fromEntries(
    (rates.boodle || []).map((pkg) => [pkg.id, { label: pkg.label, price: pkg.price }])
  );
  return {
    bilao,
    boodle,
    petDepositPerPet: rates.petDepositPerPet ?? DEFAULT_FOOD_ADD_ON_RATES.petDepositPerPet,
  };
}

/** Load food add-on rates from site_settings (merged with defaults). */
export async function getFoodAddOnRates(db = pool) {
  const [rows] = await db.query(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [FOOD_ADD_ON_RATES_SETTING_KEY]
  );
  if (!rows.length || !rows[0].setting_value) {
    return packageMapsFromRates(structuredClone(DEFAULT_FOOD_ADD_ON_RATES));
  }

  try {
    const parsed = JSON.parse(rows[0].setting_value);
    return packageMapsFromRates(mergeRates(parsed));
  } catch {
    return packageMapsFromRates(structuredClone(DEFAULT_FOOD_ADD_ON_RATES));
  }
}

/** Full merged rates (arrays) for API responses. */
export async function getFoodAddOnRatesPublic(db = pool) {
  const [rows] = await db.query(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [FOOD_ADD_ON_RATES_SETTING_KEY]
  );
  if (!rows.length || !rows[0].setting_value) {
    return structuredClone(DEFAULT_FOOD_ADD_ON_RATES);
  }
  try {
    return mergeRates(JSON.parse(rows[0].setting_value));
  } catch {
    return structuredClone(DEFAULT_FOOD_ADD_ON_RATES);
  }
}

export function foodAddOnRatesToSettings(rates) {
  return {
    [FOOD_ADD_ON_RATES_SETTING_KEY]: JSON.stringify(rates),
  };
}

function parseRatesBody(body) {
  if (body?.food_add_on_rates == null) return null;
  if (typeof body.food_add_on_rates === 'string') {
    try {
      return JSON.parse(body.food_add_on_rates);
    } catch {
      return null;
    }
  }
  if (typeof body.food_add_on_rates === 'object') {
    return body.food_add_on_rates;
  }
  return null;
}

export function validateFoodAddOnRatesInput(body) {
  const parsed = parseRatesBody(body);
  if (parsed == null) {
    if (body?.food_add_on_rates != null) {
      return { errors: ['Food add-on rates must be valid JSON.'], parsed: null };
    }
    return { errors: [], parsed: null };
  }

  const errors = [];

  if (Array.isArray(parsed.bilao)) {
    parsed.bilao.forEach((row) => {
      const price = parseFloat(row?.price);
      if (row?.price != null && (!Number.isFinite(price) || price < 0)) {
        errors.push(`Enter a valid bilao price for ${row.id || 'package'}.`);
      }
      const pax = parseInt(row?.pax, 10);
      if (row?.pax != null && (!Number.isFinite(pax) || pax < 1)) {
        errors.push(`Enter a valid pax count for bilao ${row.id || 'package'}.`);
      }
    });
  }

  if (Array.isArray(parsed.boodle)) {
    parsed.boodle.forEach((row) => {
      const price = parseFloat(row?.price);
      if (row?.price != null && (!Number.isFinite(price) || price < 0)) {
        errors.push(`Enter a valid boodle fight price for ${row.id || 'tier'}.`);
      }
    });
  }

  if (parsed.petDepositPerPet != null) {
    const n = parseFloat(parsed.petDepositPerPet);
    if (!Number.isFinite(n) || n < 0) {
      errors.push('Enter a valid pet deposit amount.');
    }
  }

  if (errors.length > 0) return { errors, parsed: null };

  return { errors: [], parsed: mergeRates(parsed) };
}
