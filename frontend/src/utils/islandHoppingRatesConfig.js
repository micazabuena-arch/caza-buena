import { ISLAND_HOPPING_RATES } from '../data/islandHoppingRates';

export const ISLAND_HOPPING_RATES_SETTING_KEY = 'island_hopping_rates';

function parseMoney(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Merge API / saved settings with built-in defaults. */
export function resolveIslandHoppingRates(fromApi) {
  if (!fromApi || typeof fromApi !== 'object') {
    return structuredClone(ISLAND_HOPPING_RATES);
  }

  const base = structuredClone(ISLAND_HOPPING_RATES);

  if (fromApi.entrance) {
    for (const key of ['infant', 'regular', 'senior', 'pwd']) {
      if (fromApi.entrance[key]?.rate != null) {
        base.entrance[key].rate = parseMoney(
          fromApi.entrance[key].rate,
          base.entrance[key].rate
        );
      }
    }
  }

  if (Array.isArray(fromApi.boat)) {
    base.boat = base.boat.map((boat) => {
      const saved = fromApi.boat.find((row) => row.id === boat.id);
      if (!saved) return boat;
      return { ...boat, rate: parseMoney(saved.rate, boat.rate) };
    });
  }

  base.facilitationFee = parseMoney(fromApi.facilitationFee, base.facilitationFee);
  base.deluxeFacilitationFee = parseMoney(
    fromApi.deluxeFacilitationFee,
    base.deluxeFacilitationFee
  );
  base.garbageFee = parseMoney(fromApi.garbageFee, base.garbageFee);

  return base;
}

export function islandHoppingRatesFromSettings(settings = {}) {
  if (settings.island_hopping_rates) {
    return resolveIslandHoppingRates(settings.island_hopping_rates);
  }
  if (settings[ISLAND_HOPPING_RATES_SETTING_KEY]) {
    try {
      const parsed =
        typeof settings[ISLAND_HOPPING_RATES_SETTING_KEY] === 'string'
          ? JSON.parse(settings[ISLAND_HOPPING_RATES_SETTING_KEY])
          : settings[ISLAND_HOPPING_RATES_SETTING_KEY];
      return resolveIslandHoppingRates(parsed);
    } catch {
      return structuredClone(ISLAND_HOPPING_RATES);
    }
  }
  return structuredClone(ISLAND_HOPPING_RATES);
}
