import multer from 'multer';

const storage = multer.memoryStorage();

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const idDocumentFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('File must be JPG, PNG, WebP, or PDF'));
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
