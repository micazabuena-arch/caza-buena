import fs from 'fs';
import path from 'path';
import { findFrontendDistDir } from './ensureFrontendBuilt.js';

const ASSET_MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function isInsideDir(parentDir, filePath) {
  const parent = path.resolve(parentDir);
  const file = path.resolve(filePath);
  return file === parent || file.startsWith(`${parent}${path.sep}`);
}

function getMime(filePath) {
  return ASSET_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function readIndexHtml(distAbs) {
  const indexPath = path.join(distAbs, 'index.html');
  try {
    const stat = fs.statSync(indexPath);
    if (!stat.isFile() || stat.size < 50) return null;
    return fs.readFileSync(indexPath, 'utf8');
  } catch (err) {
    console.error(`Failed to read ${indexPath}:`, err.message);
    return null;
  }
}

function sendSpaIndex(distAbs, res) {
  const html = readIndexHtml(distAbs);
  if (!html) {
    res.status(503).type('text/plain').send(
      'Caza Buena API is running, but frontend/dist/index.html is missing or invalid.\n' +
        'Redeploy with build command: npm run build'
    );
    return;
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(html);
}

/**
 * Hostinger's filesystem rejects express sendFile for dist assets (403 Forbidden)
 * while fs.readFile works — use readFile for every static response.
 */
function sendDistFile(filePath, req, res) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;

    const body = fs.readFileSync(filePath);
    res.setHeader('Content-Type', getMime(filePath));
    res.setHeader('Cache-Control', filePath.endsWith('.html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable');

    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', body.length);
      res.end();
      return true;
    }

    res.end(body);
    return true;
  } catch (err) {
    console.error(`Failed to serve ${filePath}:`, err.message);
    return false;
  }
}

/**
 * Serve the React SPA from the same origin as /api.
 * Avoids cross-origin preflight (OPTIONS) blocked by Hostinger CDN on home IPs.
 */
export function mountFrontend(app) {
  const dist = findFrontendDistDir();
  const distAbs = dist ? path.resolve(dist) : null;
  const indexHtml = distAbs ? path.join(distAbs, 'index.html') : null;

  if (!distAbs || !readIndexHtml(distAbs)) {
    console.warn('Frontend not mounted — frontend/dist/index.html not found or unreadable');
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
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

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();

    const rel = decodeURIComponent(req.path).replace(/^\/+/, '');

    if (!rel) {
      sendSpaIndex(distAbs, res);
      return;
    }

    if (rel.includes('..')) {
      res.status(400).type('text/plain').send('Bad request');
      return;
    }

    const filePath = path.resolve(distAbs, rel);
    if (!isInsideDir(distAbs, filePath)) {
      res.status(403).type('text/plain').send('Forbidden');
      return;
    }

    if (sendDistFile(filePath, req, res)) return;

    // Real missing asset — do not return index.html (that causes a blank white page).
    if (path.extname(rel)) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }

    sendSpaIndex(distAbs, res);
  });

  console.log(`Serving frontend from ${distAbs} (index: ${indexHtml})`);
  return true;
}
