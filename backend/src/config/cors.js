/** Strip trailing slash so https://site.com and https://site.com/ both match */
function normalizeOrigin(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

/**
 * Allowed browser origins for CORS.
 * FRONTEND_URL may be a single URL or comma-separated list.
 */
export function getAllowedOrigins() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173';
  return raw
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

/** Hostinger serves frontend + API on separate *.hostingersite.com subdomains */
function isHostingerPreviewOrigin(origin) {
  return /^https:\/\/[\w-]+\.hostingersite\.com$/i.test(origin);
}

export function isOriginAllowed(origin) {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  const allowed = getAllowedOrigins();

  if (allowed.includes(normalized)) return true;

  // Safety net while frontend and API live on different Hostinger subdomains
  if (isHostingerPreviewOrigin(normalized)) return true;

  return false;
}

export function corsOptions() {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, origin || true);
        return;
      }
      console.warn(
        `CORS blocked origin: ${origin} (FRONTEND_URL=${process.env.FRONTEND_URL || '(not set)'})`
      );
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
