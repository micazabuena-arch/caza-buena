import { ensureFrontendBuilt } from '../backend/src/config/ensureFrontendBuilt.js';

try {
  ensureFrontendBuilt();
} catch (err) {
  // Do not block `npm start` — API should still boot; frontend may 503 until build succeeds.
  console.error('[prestart] Frontend build skipped:', err.message);
}
