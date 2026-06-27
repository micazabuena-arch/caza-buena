import fs from 'fs';
import path from 'path';
import express from 'express';
import { findFrontendDistDir } from './ensureFrontendBuilt.js';

const ASSET_MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

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

  const assetsDir = path.join(dist, 'assets');

  // Hostinger HTTP/2 can fail on range requests / parallel preloads — serve assets explicitly.
  app.use('/assets', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const rel = String(req.path || '').replace(/^\/+/, '');
    if (!rel || rel.includes('..')) return res.status(400).end();

    const filePath = path.join(assetsDir, rel);
    if (!filePath.startsWith(assetsDir) || !fs.existsSync(filePath)) return next();

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', ASSET_MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    res.sendFile(filePath, { acceptRanges: false, dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) next(err);
    });
  });

  app.use(
    express.static(dist, {
      index: false,
      dotfiles: 'ignore',
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml, { acceptRanges: false });
  });

  console.log(`Serving frontend from ${dist}`);
  return true;
}
