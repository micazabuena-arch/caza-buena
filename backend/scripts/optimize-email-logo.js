import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(root, '../frontend/public/logo.png');
const out = path.resolve(root, 'assets/email-logo.png');

await sharp(src)
  .resize({ width: 160, withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true })
  .toFile(out);

const { size } = await import('fs').then((fs) => ({
  size: fs.statSync(out).size,
}));
console.log(`Email logo saved: ${out} (${Math.round(size / 1024)} KB)`);
