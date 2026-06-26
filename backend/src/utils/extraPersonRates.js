import pool from '../config/database.js';

export const DEFAULT_EXTRA_PERSON_RATES = {
  adult_weekday: 800,
  adult_weekend: 900,
  child_7_12: 400,
  child_under_6: 0,
};

const SETTING_KEYS = {
  adult_weekday: 'extra_pax_adult_weekday',
  adult_weekend: 'extra_pax_adult_weekend',
  child_7_12: 'extra_pax_child_7_12',
};

function parseRate(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Load extra guest per-night rates from site_settings (with defaults). */
export async function getExtraPersonRates(db = pool) {
  const [rows] = await db.query(
    `SELECT setting_key, setting_value FROM site_settings
     WHERE setting_key IN (?, ?, ?)`,
    Object.values(SETTING_KEYS)
  );
  const map = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));

  return {
    adult_weekday: parseRate(
      map[SETTING_KEYS.adult_weekday],
      DEFAULT_EXTRA_PERSON_RATES.adult_weekday
    ),
    adult_weekend: parseRate(
      map[SETTING_KEYS.adult_weekend],
      DEFAULT_EXTRA_PERSON_RATES.adult_weekend
    ),
    child_7_12: parseRate(map[SETTING_KEYS.child_7_12], DEFAULT_EXTRA_PERSON_RATES.child_7_12),
    child_under_6: 0,
  };
}

export function extraPersonRatesToSettings(rates) {
  return {
    [SETTING_KEYS.adult_weekday]: String(rates.adult_weekday),
    [SETTING_KEYS.adult_weekend]: String(rates.adult_weekend),
    [SETTING_KEYS.child_7_12]: String(rates.child_7_12),
  };
}

export function validateExtraPersonRatesInput(body) {
  const errors = [];
  const parsed = {};

  for (const [field, key] of Object.entries(SETTING_KEYS)) {
    if (body[key] === undefined) continue;
    const n = parseFloat(body[key]);
    if (!Number.isFinite(n) || n < 0) {
      errors.push(`${field.replace(/_/g, ' ')} must be a valid amount (0 or greater).`);
    } else {
      parsed[key] = String(Math.round(n * 100) / 100);
    }
  }

  return { errors, parsed };
}
