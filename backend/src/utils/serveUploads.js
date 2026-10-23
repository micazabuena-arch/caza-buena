import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from './fileUpload.js';

const UPLOAD_MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
};

function isInsideDir(parentDir, filePath) {
  const parent = path.resolve(parentDir);
  const file = path.resolve(filePath);
  return file === parent || file.startsWith(`${parent}${path.sep}`);
}

/**
 * Serve /uploads with fs.readFile (same Hostinger-safe approach as SPA assets).
 * express.static / sendFile has historically 403'd on this host for some paths.
 */
export function mountUploads(app, uploadsDir = UPLOADS_DIR) {
  const root = path.resolve(uploadsDir);
  fs.mkdirSync(root, { recursive: true });

  app.use('/uploads', (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).type('text/plain').send('Method not allowed');
      return;
    }

    const rel = decodeURIComponent(req.path || '').replace(/^\/+/, '');
    if (!rel || rel.includes('..')) {
      res.status(400).type('text/plain').send('Bad request');
      return;
    }

    const filePath = path.resolve(root, rel);
    if (!isInsideDir(root, filePath)) {
      res.status(403).type('text/plain').send('Forbidden');
      return;
    }

    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }

      const body = fs.readFileSync(filePath);
      const mime = UPLOAD_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', body.length);

      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(body);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      console.error(`Failed to serve upload ${filePath}:`, err.message);
      res.status(500).type('text/plain').send('Unable to read file');
    }
  });

  console.log(`Serving uploads from ${root}`);
}
