import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root (backend/src/config -> ../../..) */
function getRepoRoot() {
  return path.resolve(__dirname, '../../..');
}

export function getFrontendSourceDir() {
  const candidates = [
    path.resolve(process.cwd(), 'frontend'),
    path.resolve(getRepoRoot(), 'frontend'),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'package.json'))) || candidates[0];
}

export function findFrontendDistDir() {
  const candidates = [
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(getRepoRoot(), 'frontend/dist'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

/** Build frontend/dist when missing (Hostinger may skip the build step). */
export function ensureFrontendBuilt() {
  const existing = findFrontendDistDir();
  if (existing) {
    console.log('Frontend build found:', existing);
    return existing;
  }

  const frontendDir = getFrontendSourceDir();
  const pkg = path.join(frontendDir, 'package.json');

  if (!fs.existsSync(pkg)) {
    console.error('cwd:', process.cwd());
    console.error('repo root:', getRepoRoot());
    throw new Error(`frontend/package.json not found (looked in ${frontendDir})`);
  }

  console.log('frontend/dist missing — building React app from', frontendDir);

  execSync('npm install && npm run build', {
    cwd: frontendDir,
    stdio: 'inherit',
    env: process.env,
  });

  const built = findFrontendDistDir();
  if (!built) {
    throw new Error('Frontend build finished but frontend/dist/index.html is still missing');
  }

  console.log('Frontend build ready:', built);
  return built;
}
