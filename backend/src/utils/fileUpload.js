import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Local upload root.
 * Default: backend/uploads (fine for local dev).
 * Production (Hostinger): set UPLOADS_DIR to a folder OUTSIDE the git deploy
 * directory so pull/redeploy does not wipe gallery, QR, and payment proofs.
 * Example: UPLOADS_DIR=/home/USER/caza-buena-uploads
 */
const defaultUploadsDir = path.join(__dirname, '../../uploads');
const envUploadsDir = (process.env.UPLOADS_DIR || '').trim();
export const UPLOADS_DIR = envUploadsDir
  ? path.resolve(envUploadsDir)
  : defaultUploadsDir;

// Create root once so static serving and first upload never fail on a fresh host
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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
