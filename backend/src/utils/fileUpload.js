import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

// Do NOT import sharp at top level — a native-binding failure on Hostinger
// would crash the whole API (503). Load it only when converting HEIC.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Local upload root.
 * Default: backend/uploads (fine for local dev).
 * Production (Hostinger): set UPLOADS_DIR to a folder OUTSIDE the git deploy
 * directory so pull/redeploy does not wipe gallery, QR, and payment proofs.
 *
 * Hostinger File Manager shows /files/... but Node cannot use that virtual path.
 * We map /files/foo → $HOME/foo (e.g. /files/caza-buena-uploads → ~/caza-buena-uploads).
 * A bad UPLOADS_DIR must never crash the API — we fall back to backend/uploads.
 */
const defaultUploadsDir = path.join(__dirname, '../../uploads');

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir() || '';
}

/** True if this folder already has copied site media (prefer over empty dirs). */
function uploadsContentScore(dir) {
  let score = 0;
  for (const name of ['rooms', 'gallery', 'qr-codes', 'whats-new', 'payment-proofs']) {
    try {
      if (fs.existsSync(path.join(dir, name))) score += 1;
    } catch {
      /* ignore */
    }
  }
  return score;
}

function tryUseDir(dir) {
  if (!dir) return null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    // Prove we can write (Hostinger may allow mkdir but not write elsewhere)
    const probe = path.join(dir, '.write-test');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return dir;
  } catch (err) {
    console.warn(`[upload] Cannot use uploads dir ${dir}:`, err.message);
    return null;
  }
}

function resolveUploadsDir() {
  const raw = (process.env.UPLOADS_DIR || '').trim();
  if (!raw) {
    const fallback = tryUseDir(defaultUploadsDir) || defaultUploadsDir;
    return fallback;
  }

  const home = homeDir();
  const candidates = [];

  // Hostinger File Manager path → real home path
  if (raw === '/files' || raw.startsWith('/files/')) {
    const rel = raw.replace(/^\/files\/?/, '');
    if (home) candidates.push(path.join(home, rel));
  }

  if (raw.startsWith('~/')) {
    if (home) candidates.push(path.join(home, raw.slice(2)));
  } else if (raw === '~') {
    if (home) candidates.push(home);
  }

  // Bare folder name sitting next to nodejs/ in File Manager home
  if (!path.isAbsolute(raw) && !raw.startsWith('~')) {
    candidates.push(path.resolve(raw));
    if (home) candidates.push(path.join(home, raw));
  } else if (path.isAbsolute(raw) && !raw.startsWith('/files')) {
    candidates.push(path.resolve(raw));
  }

  // Always keep default as last resort so a bad env cannot 503 the site
  candidates.push(defaultUploadsDir);

  const usable = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const ok = tryUseDir(resolved);
    if (ok) usable.push(ok);
  }

  if (usable.length === 0) {
    console.error('[upload] No writable uploads directory — using default path anyway');
    return defaultUploadsDir;
  }

  usable.sort((a, b) => uploadsContentScore(b) - uploadsContentScore(a));
  const chosen = usable[0];
  if (chosen !== path.resolve(raw) && raw.startsWith('/files')) {
    console.log(`[upload] Mapped Hostinger path ${raw} → ${chosen}`);
  }
  return chosen;
}

export const UPLOADS_DIR = resolveUploadsDir();
console.log(`[upload] Using uploads directory: ${UPLOADS_DIR}`);

/** Ensure upload subdirectory exists */
function ensureDir(subfolder) {
  const dir = path.join(UPLOADS_DIR, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * iPhone HEIC/HEIF → JPEG so admin preview and browsers can open the proof.
 * If conversion fails (missing libheif on host), keep the original bytes.
 */
async function normalizeBufferForStorage(buffer, originalName = '', mimetype = '') {
  const mime = String(mimetype || '').toLowerCase();
  const ext = path.extname(originalName || '').toLowerCase();
  const isHeic =
    mime.includes('heic') ||
    mime.includes('heif') ||
    ext === '.heic' ||
    ext === '.heif';

  if (!isHeic) {
    return { buffer, originalName };
  }

  try {
    const sharp = (await import('sharp')).default;
    const jpeg = await sharp(buffer).rotate().jpeg({ quality: 90 }).toBuffer();
    const nextName = String(originalName || 'proof.heic').replace(/\.(heic|heif)$/i, '.jpg');
    return { buffer: jpeg, originalName: nextName.endsWith('.jpg') ? nextName : `${nextName}.jpg` };
  } catch (err) {
    console.warn('[upload] HEIC→JPEG conversion failed, storing original:', err.message);
    return { buffer, originalName };
  }
}

/** Save buffer to local disk; returns public URL path */
export function saveLocalFile(buffer, subfolder, originalName = '') {
  const dir = ensureDir(subfolder);
  let ext = path.extname(originalName || '').toLowerCase();
  if (!ext) ext = '.jpg';
  else if (ext === '.jpeg' || ext === '.jpe') ext = '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/${subfolder}/${filename}`;
}

/**
 * Upload file: Cloudinary when configured, otherwise local storage.
 * Works without any third-party credentials.
 */
export async function uploadFile(buffer, subfolder, options = {}) {
  const { originalName = '', resourceType = 'image', mimetype = '' } = options;

  const normalized = await normalizeBufferForStorage(buffer, originalName, mimetype);
  const name = normalized.originalName;
  const data = normalized.buffer;

  if (isCloudinaryConfigured()) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `caza-buena/${subfolder}`, resource_type: resourceType },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(data);
      });
      return { url: result.secure_url, publicId: result.public_id };
    } catch (err) {
      // Fall back to local disk so a Cloudinary outage does not block guest payment proofs
      console.error('[upload] Cloudinary failed, falling back to local disk:', err.message);
      const url = saveLocalFile(data, subfolder, name);
      return { url, publicId: null };
    }
  }

  const url = saveLocalFile(data, subfolder, name);
  return { url, publicId: null };
}
