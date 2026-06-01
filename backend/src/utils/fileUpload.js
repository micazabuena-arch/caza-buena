import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/** Ensure upload subdirectory exists */
function ensureDir(subfolder) {
  const dir = path.join(UPLOADS_DIR, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Save buffer to local disk; returns public URL path */
export function saveLocalFile(buffer, subfolder, originalName = '') {
  const dir = ensureDir(subfolder);
  const ext = path.extname(originalName) || '.jpg';
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
  const { originalName = '', resourceType = 'image' } = options;

  if (isCloudinaryConfigured()) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `caza-buena/${subfolder}`, resource_type: resourceType },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  const url = saveLocalFile(buffer, subfolder, originalName);
  return { url, publicId: null };
}
