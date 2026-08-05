import pool from '../config/database.js';

export const ISLAND_HOPPING_RATES_SETTING_KEY = 'island_hopping_rates';

/** Default Hundred Islands hopping rates (used when nothing is saved yet). */
export const DEFAULT_ISLAND_HOPPING_RATES = {
  entrance: {
    infant: { maxAge: 4, label: 'Entrance fee (0–4 years old)', rate: 20 },
    regular: { minAge: 5, maxAge: 59, label: 'Entrance fee (5–59 years old)', rate: 130 },
    senior: { label: 'Senior citizen (with 20% discount)', rate: 108 },
    pwd: { label: 'PWD (with 20% discount)', rate: 108 },
  },
  boat: [
    { id: 'small', label: 'SMALL (1–5 PAX)', min: 1, max: 5, rate: 1600 },
    { id: 'medium', label: 'MEDIUM (6–10 PAX)', min: 6, max: 10, rate: 2000 },
    { id: 'large', label: 'LARGE (11–15 PAX)', min: 11, max: 15, rate: 2400 },
    { id: 'deluxe', label: 'DELUXE (16–20 PAX)', min: 16, max: 20, rate: 2800 },
  ],
  facilitationFee: 300,
  deluxeFacilitationFee: 500,
  garbageFee: 200,
  maxPassengersPerBoat: 20,
  maxPassengers: 20,
};

function parseMoney(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function mergeRates(parsed) {
  const base = structuredClone(DEFAULT_ISLAND_HOPPING_RATES);
  if (!parsed || typeof parsed !== 'object') return base;

  if (parsed.entrance) {
    for (const key of ['infant', 'regular', 'senior', 'pwd']) {
      if (parsed.entrance[key]?.rate != null) {
        base.entrance[key].rate = parseMoney(
          parsed.entrance[key].rate,
          base.entrance[key].rate
        );
      }
    }
  }

  if (Array.isArray(parsed.boat)) {
    base.boat = base.boat.map((boat) => {
      const saved = parsed.boat.find((row) => row.id === boat.id);
      if (!saved) return boat;
      return {
        ...boat,
        rate: parseMoney(saved.rate, boat.rate),
      };
    });
  }

  base.facilitationFee = parseMoney(parsed.facilitationFee, base.facilitationFee);
  base.deluxeFacilitationFee = parseMoney(
    parsed.deluxeFacilitationFee,
    base.deluxeFacilitationFee
  );
  base.garbageFee = parseMoney(parsed.garbageFee, base.garbageFee);

  return base;
}

/** Load island hopping rates from site_settings (merged with defaults). */
export async function getIslandHoppingRates(db = pool) {
  const [rows] = await db.query(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [ISLAND_HOPPING_RATES_SETTING_KEY]
  );
  if (!rows.length || !rows[0].setting_value) {
    return structuredClone(DEFAULT_ISLAND_HOPPING_RATES);
  }

  try {
    const parsed = JSON.parse(rows[0].setting_value);
    return mergeRates(parsed);
  } catch {
    return structuredClone(DEFAULT_ISLAND_HOPPING_RATES);
  }
}

export function islandHoppingRatesToSettings(rates) {
  return {
    [ISLAND_HOPPING_RATES_SETTING_KEY]: JSON.stringify(rates),
  };
}

export function ratesFromSettingsMap(settings = {}) {
  const raw = settings[ISLAND_HOPPING_RATES_SETTING_KEY];
  if (!raw) return structuredClone(DEFAULT_ISLAND_HOPPING_RATES);
  try {
    return mergeRates(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch {
    return structuredClone(DEFAULT_ISLAND_HOPPING_RATES);
  }
}

function parseRatesBody(body) {
  if (body?.island_hopping_rates == null) return null;
  if (typeof body.island_hopping_rates === 'string') {
    try {
      return JSON.parse(body.island_hopping_rates);
    } catch {
      return null;
    }
  }
  if (typeof body.island_hopping_rates === 'object') {
    return body.island_hopping_rates;
  }
  return null;
}

export function validateIslandHoppingRatesInput(body) {
  const parsed = parseRatesBody(body);
  if (parsed == null) {
    if (body?.island_hopping_rates != null) {
      return { errors: ['Island hopping rates must be valid JSON.'], parsed: null };
    }
    return { errors: [], parsed: null };
  }

  const errors = [];
  const entrance = parsed.entrance || {};
  for (const key of ['infant', 'regular', 'senior', 'pwd']) {
    const rate = entrance[key]?.rate;
    if (rate == null) continue;
    const n = parseFloat(rate);
    if (!Number.isFinite(n) || n < 0) {
      errors.push(`Enter a valid ${key} entrance fee.`);
    }
  }

  if (Array.isArray(parsed.boat)) {
    parsed.boat.forEach((row) => {
      const n = parseFloat(row?.rate);
      if (row?.rate != null && (!Number.isFinite(n) || n < 0)) {
        errors.push(`Enter a valid boat rate for ${row.id || 'boat'}.`);
      }
    });
  }

  for (const field of ['facilitationFee', 'deluxeFacilitationFee', 'garbageFee']) {
    if (parsed[field] == null) continue;
    const n = parseFloat(parsed[field]);
    if (!Number.isFinite(n) || n < 0) {
      errors.push(`Enter a valid ${field}.`);
    }
  }

  if (errors.length > 0) return { errors, parsed: null };

  return { errors: [], parsed: mergeRates(parsed) };
}
