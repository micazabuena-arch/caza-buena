import fs from 'fs';
import path from 'path';
import express from 'express';
import { findFrontendDistDir } from './ensureFrontendBuilt.js';

/**
 * Serve the React SPA from the same origin as /api.
 * Avoids cross-origin preflight (OPTIONS) blocked by Hostinger CDN on home IPs.
 */
export function mountFrontend(app) {
  const dist = findFrontendDistDir();
  const indexHtml = dist ? path.join(dist, 'index.html') : null;

  if (!indexHtml || !fs.existsSync(indexHtml)) {
    console.warn('Frontend not mounted — frontend/dist/index.html not found');
    app.get('/', (_req, res) => {
      res.status(503).type('text/plain').send(
        'Caza Buena API is running, but the website build is missing.\n' +
          'In Hostinger set:\n' +
          '  Build command: npm run build\n' +
          '  Start command: npm start\n' +
          'Then redeploy and check deploy logs for build errors.'
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
