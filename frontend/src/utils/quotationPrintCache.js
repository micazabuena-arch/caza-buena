const PRINT_CACHE_KEY = 'quotation_print_cache';
const CACHE_TTL_MS = 5 * 60 * 1000;

export function storeQuotationPrintCache(quote) {
  localStorage.setItem(
    PRINT_CACHE_KEY,
    JSON.stringify({ quote, at: Date.now() })
  );
}

export function readQuotationPrintCache() {
  try {
    const raw = localStorage.getItem(PRINT_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.at > CACHE_TTL_MS) return null;
    return data.quote ?? null;
  } catch {
    return null;
  }
}

export function clearQuotationPrintCache() {
  localStorage.removeItem(PRINT_CACHE_KEY);
}

export function hasQuotationPrintCache() {
  return Boolean(readQuotationPrintCache());
}
