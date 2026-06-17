import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Built React app (repo root frontend/dist) */
export function getFrontendDistPath() {
  return path.resolve(__dirname, '../../../frontend/dist');
}

export function shouldServeFrontend() {
  if (process.env.SERVE_FRONTEND === '0') return false;
  if (process.env.SERVE_FRONTEND === '1') return true;

  const dist = getFrontendDistPath();
  return fs.existsSync(path.join(dist, 'index.html'));
}

/**
 * Serve the React SPA from the same origin as /api.
 * Avoids cross-origin preflight (OPTIONS) blocked by Hostinger CDN on home IPs.
 */
export function mountFrontend(app) {
  if (!shouldServeFrontend()) return false;

  const dist = getFrontendDistPath();
  app.use(express.static(dist, { index: false }));

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });

  console.log(`Serving frontend from ${dist}`);
  return true;
}
