import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const distIndex = path.resolve('frontend/dist/index.html');

if (fs.existsSync(distIndex)) {
  console.log('Frontend build found:', distIndex);
  process.exit(0);
}

console.log('frontend/dist missing — building React app for production...');

try {
  execSync('npm install --prefix frontend && npm run build --prefix frontend', {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  console.error('Frontend build failed:', err.message);
  process.exit(1);
}

if (!fs.existsSync(distIndex)) {
  console.error('Build finished but frontend/dist/index.html is still missing.');
  process.exit(1);
}

console.log('Frontend build ready:', distIndex);
