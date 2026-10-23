import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(Object.assign(new Error('Only image files are allowed'), { status: 400 }));
  },
});

/**
 * Phone screenshots often send non-standard MIME types:
 * - image/jpg (should be image/jpeg)
 * - image/heic / image/heif (iPhone)
 * - application/octet-stream with a .jpg/.png name
 * Rejecting those made guest payment-proof uploads fail after switching to local storage.
 */
const ALLOWED_DOC_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const ALLOWED_DOC_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
  '.heic',
  '.heif',
]);

function isAllowedIdDocument(file) {
  const mime = String(file.mimetype || '').toLowerCase().trim();
  if (ALLOWED_DOC_MIMES.has(mime)) return true;
  // Some mobile browsers send a generic binary type — trust the extension.
  if (mime === 'application/octet-stream' || mime === '' || mime === 'binary/octet-stream') {
    const ext = path.extname(file.originalname || '').toLowerCase();
    return ALLOWED_DOC_EXTS.has(ext);
  }
  return false;
}

const idDocumentFilter = (_req, file, cb) => {
  if (isAllowedIdDocument(file)) {
    cb(null, true);
    return;
  }
  const err = new Error('File must be JPG, PNG, WebP, HEIC, or PDF');
  err.status = 400;
  cb(err);
};

export const uploadPaymentProof = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: idDocumentFilter,
});

/** ID document uploads (senior citizen, PWD, etc.) */
export const uploadSeniorId = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: idDocumentFilter,
});

export const uploadPwdId = uploadSeniorId;
