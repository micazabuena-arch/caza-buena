import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadFile } from '../utils/fileUpload.js';

const router = Router();

/** Soft cap so the admin UI / payload stay manageable */
export const MAX_WHATS_NEW_SLIDES = 12;

const KEYS = {
  heading: 'whats_new_heading',
  text: 'whats_new_text',
  image1: 'whats_new_image_1',
  image2: 'whats_new_image_2',
  image3: 'whats_new_image_3',
  slideMeta: 'whats_new_slide_meta',
  /** Full slide list (image + heading + text) — supports more than 3 slides */
  slides: 'whats_new_slides',
};

const DEFAULTS = {
  heading: "What's New at Caza Buena",
  text: 'Fresh updates, new highlights, and the latest moments from our resort.',
};

function emptySlide() {
  return { image_url: '', heading: '', text: '' };
}

function clampSlide(slide = {}) {
  return {
    image_url: String(slide.image_url || '').trim(),
    heading: String(slide.heading || '').trim(),
    text: String(slide.text || '').trim(),
  };
}

function parseJsonArray(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Prefer the full slides JSON. Fall back to legacy image_1..3 + slide_meta.
 */
function buildSlidesFromMap(map) {
  const stored = parseJsonArray(map[KEYS.slides]);
  if (stored?.length) {
    return stored.slice(0, MAX_WHATS_NEW_SLIDES).map(clampSlide);
  }

  const legacyImages = [
    map[KEYS.image1] || '',
    map[KEYS.image2] || '',
    map[KEYS.image3] || '',
  ];
  const meta = parseJsonArray(map[KEYS.slideMeta]) || [];

  return [0, 1, 2].map((i) =>
    clampSlide({
      image_url: legacyImages[i],
      heading: meta[i]?.heading,
      text: meta[i]?.text,
    })
  );
}

async function readWhatsNewSettings() {
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM site_settings
     WHERE setting_key IN (?, ?, ?, ?, ?, ?, ?)`,
    [
      KEYS.heading,
      KEYS.text,
      KEYS.image1,
      KEYS.image2,
      KEYS.image3,
      KEYS.slideMeta,
      KEYS.slides,
    ]
  );
  const map = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  const slides = buildSlidesFromMap(map);

  return {
    heading: map[KEYS.heading] || DEFAULTS.heading,
    text: map[KEYS.text] || DEFAULTS.text,
    // Legacy first-3 image URLs (kept for older clients)
    images: [0, 1, 2].map((i) => slides[i]?.image_url || ''),
    slides,
    max_slides: MAX_WHATS_NEW_SLIDES,
  };
}

async function saveSetting(key, value) {
  await pool.query(
    `INSERT INTO site_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value]
  );
}

/** Persist slides JSON + keep legacy image_1..3 / meta in sync for the first three. */
async function saveSlides(slides) {
  const normalized = slides.slice(0, MAX_WHATS_NEW_SLIDES).map(clampSlide);
  while (normalized.length < 1) normalized.push(emptySlide());

  await saveSetting(KEYS.slides, JSON.stringify(normalized));
  await saveSetting(KEYS.image1, normalized[0]?.image_url || '');
  await saveSetting(KEYS.image2, normalized[1]?.image_url || '');
  await saveSetting(KEYS.image3, normalized[2]?.image_url || '');
  await saveSetting(
    KEYS.slideMeta,
    JSON.stringify(
      normalized.slice(0, 3).map((s) => ({ heading: s.heading, text: s.text }))
    )
  );
  return normalized;
}

function normalizeSlidesInput(body) {
  if (Array.isArray(body?.slides) && body.slides.length) {
    return body.slides.slice(0, MAX_WHATS_NEW_SLIDES).map(clampSlide);
  }

  // Legacy payload shape
  const images = Array.isArray(body?.images) ? body.images : [];
  const slideMeta = Array.isArray(body?.slide_meta) ? body.slide_meta : [];
  const len = Math.min(
    MAX_WHATS_NEW_SLIDES,
    Math.max(images.length, slideMeta.length, 3)
  );
  return Array.from({ length: len }, (_, i) =>
    clampSlide({
      image_url: images[i],
      heading: slideMeta[i]?.heading,
      text: slideMeta[i]?.text,
    })
  );
}

router.get('/', async (_req, res) => {
  const data = await readWhatsNewSettings();
  res.json(data);
});

router.put('/admin', authenticateAdmin, async (req, res) => {
  const heading = String(req.body?.heading || '').trim();
  const text = String(req.body?.text || '').trim();
  const slides = normalizeSlidesInput(req.body);

  if (!heading) return res.status(400).json({ message: 'Page heading is required.' });
  if (!text) return res.status(400).json({ message: 'Page text is required.' });
  if (!slides.length) {
    return res.status(400).json({ message: 'Add at least one slide.' });
  }
  if (slides.length > MAX_WHATS_NEW_SLIDES) {
    return res.status(400).json({
      message: `You can have at most ${MAX_WHATS_NEW_SLIDES} slides.`,
    });
  }

  await saveSetting(KEYS.heading, heading);
  await saveSetting(KEYS.text, text);
  await saveSlides(slides);

  const data = await readWhatsNewSettings();
  res.json({ message: "What's New updated.", ...data });
});

router.post('/admin/upload', authenticateAdmin, uploadImage.single('image'), async (req, res) => {
  const slot = parseInt(req.body?.slot, 10);
  if (!Number.isFinite(slot) || slot < 1 || slot > MAX_WHATS_NEW_SLIDES) {
    return res.status(400).json({
      message: `slot must be between 1 and ${MAX_WHATS_NEW_SLIDES}.`,
    });
  }
  if (!req.file) return res.status(400).json({ message: 'Image file is required.' });

  const { url } = await uploadFile(req.file.buffer, 'whats-new', {
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
  });

  // Merge into the current slides list so adding slide 4+ persists immediately
  const current = await readWhatsNewSettings();
  const slides = [...current.slides];
  while (slides.length < slot) slides.push(emptySlide());
  slides[slot - 1] = { ...slides[slot - 1], image_url: url };
  await saveSlides(slides);

  const data = await readWhatsNewSettings();
  res.status(201).json({
    message: `Image ${slot} uploaded.`,
    image_url: url,
    ...data,
  });
});

export default router;
