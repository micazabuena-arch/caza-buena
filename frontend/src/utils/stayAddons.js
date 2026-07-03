/** Parse stay_addons JSON from booking (during-stay charges). */
export function parseStayAddons(raw) {
  if (!raw) return [];
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((item, index) => ({
      id: item?.id || `addon-${index}`,
      description: String(item?.description || '').trim(),
      amount: Math.round((Number(item?.amount) || 0) * 100) / 100,
    }))
    .filter((item) => item.description && item.amount > 0);
}

export function stayAddonsTotal(rawOrList) {
  const list = Array.isArray(rawOrList) ? rawOrList : parseStayAddons(rawOrList);
  return list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

export const STAY_ADDON_PRESETS = [
  { label: 'Room extension', description: 'Room extension' },
  { label: 'Food order', description: 'Food order' },
  { label: 'Extra services', description: 'Extra services' },
];
