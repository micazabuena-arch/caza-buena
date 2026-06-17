import fs from 'fs';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Possible locations for frontend/dist on Hostinger and local dev */
export function getFrontendDistPath() {
  const candidates = [
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(__dirname, '../../../frontend/dist'),
    path.resolve(__dirname, '../../frontend/dist'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
  }

  return candidates[0];
}

export function shouldServeFrontend() {
  if (process.env.SERVE_FRONTEND === '0') return false;

  const dist = getFrontendDistPath();
  return fs.existsSync(path.join(dist, 'index.html'));
}

/**
 * Serve the React SPA from the same origin as /api.
 * Avoids cross-origin preflight (OPTIONS) blocked by Hostinger CDN on home IPs.
 */
export function mountFrontend(app) {
  const dist = getFrontendDistPath();
  const indexHtml = path.join(dist, 'index.html');

  if (!fs.existsSync(indexHtml)) {
    console.warn(`Frontend not mounted — missing ${indexHtml}`);
    app.get('/', (_req, res) => {
      res.status(503).type('text/plain').send(
        'Caza Buena API is running, but the website build is missing.\n' +
          'In Hostinger, set Build command to: npm run build\n' +
          'Then redeploy this app.'
      );
    });
    return false;
  }

  app.use(express.static(dist, { index: false }));

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(indexHtml);
  });

  console.log(`Serving frontend from ${dist}`);
  return true;
}
