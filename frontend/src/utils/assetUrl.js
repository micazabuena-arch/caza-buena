/** Resolves image/upload paths from API (local /uploads or full Cloudinary URLs) */
export function getAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  // Relative paths like /uploads/... work via Vite proxy in dev
  return path.startsWith('/') ? path : `/${path}`;
}
