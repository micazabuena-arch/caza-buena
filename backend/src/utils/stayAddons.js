/** Parse stay_addons JSON from DB (during-stay charges e.g. room extension, food). */
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

/** Validate and normalize stay add-ons from admin input. */
export function normalizeStayAddonsInput(list) {
  if (!Array.isArray(list)) return { error: 'stay_addons must be an array' };

  const normalized = [];
  for (const item of list) {
    const description = String(item?.description || '').trim();
    const amount = Math.round((Number(item?.amount) || 0) * 100) / 100;
    if (!description) return { error: 'Each add-on needs a description' };
    if (!(amount > 0)) return { error: 'Each add-on amount must be greater than zero' };
    normalized.push({
      id: item?.id || `addon-${Date.now()}-${normalized.length}`,
      description,
      amount,
    });
  }

  return { addons: normalized, total: stayAddonsTotal(normalized) };
}
