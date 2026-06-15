const TOKEN_KEY = 'admin_token';
const MIRROR_KEY = 'admin_token_print_mirror';
const PRINT_CACHE_KEY = 'island_hop_print_cache';
const CACHE_TTL_MS = 2 * 60 * 1000;

/** Brief localStorage copy so a new tab can auth when session token is tab-only. */
export function mirrorAdminTokenForNewTab() {
  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  if (!sessionToken) return;
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored !== sessionToken) {
    localStorage.setItem(TOKEN_KEY, sessionToken);
    localStorage.setItem(MIRROR_KEY, '1');
  }
}

export function clearMirroredAdminToken() {
  if (localStorage.getItem(MIRROR_KEY)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MIRROR_KEY);
  }
}

export function storeIslandHoppingPrintCache(bookingId, booking, islandHop) {
  localStorage.setItem(
    PRINT_CACHE_KEY,
    JSON.stringify({
      bookingId: String(bookingId),
      booking,
      islandHop,
      at: Date.now(),
    })
  );
}

export function readIslandHoppingPrintCache(bookingId) {
  try {
    const raw = localStorage.getItem(PRINT_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (String(data.bookingId) !== String(bookingId)) return null;
    if (Date.now() - data.at > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearIslandHoppingPrintCache() {
  localStorage.removeItem(PRINT_CACHE_KEY);
}

export function hasIslandHoppingPrintPrefetch(bookingId) {
  return Boolean(readIslandHoppingPrintCache(bookingId));
}
