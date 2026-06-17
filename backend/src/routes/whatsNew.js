import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadFile } from '../utils/fileUpload.js';

const router = Router();

const KEYS = {
  heading: 'whats_new_heading',
  text: 'whats_new_text',
  image1: 'whats_new_image_1',
  image2: 'whats_new_image_2',
  image3: 'whats_new_image_3',
  slideMeta: 'whats_new_slide_meta',
};

const DEFAULTS = {
  heading: "What's New at Caza Buena",
  text: 'Fresh updates, new highlights, and the latest moments from our resort.',
};

function defaultSlideMeta() {
  return [
    { heading: '', text: '' },
    { heading: '', text: '' },
    { heading: '', text: '' },
  ];
}

function parseSlideMeta(raw) {
  if (!raw) return defaultSlideMeta();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultSlideMeta();
    return [0, 1, 2].map((i) => ({
      heading: String(parsed[i]?.heading || '').trim(),
      text: String(parsed[i]?.text || '').trim(),
    }));
  } catch {
    return defaultSlideMeta();
  }
}

async function readWhatsNewSettings() {
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM site_settings
     WHERE setting_key IN (?, ?, ?, ?, ?, ?)`,
    [
      KEYS.heading,
      KEYS.text,
      KEYS.image1,
      KEYS.image2,
      KEYS.image3,
      KEYS.slideMeta,
    ]
  );
  const map = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  const imageUrls = [
    map[KEYS.image1] || '',
    map[KEYS.image2] || '',
    map[KEYS.image3] || '',
  ];
  const slideMeta = parseSlideMeta(map[KEYS.slideMeta]);

  const slides = [0, 1, 2].map((i) => ({
    image_url: imageUrls[i],
    heading: slideMeta[i].heading,
    text: slideMeta[i].text,
  }));

  return {
    heading: map[KEYS.heading] || DEFAULTS.heading,
    text: map[KEYS.text] || DEFAULTS.text,
    images: imageUrls,
    slides: slides.filter((s) => s.image_url),
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

function normalizeSlidesInput(body) {
  if (Array.isArray(body?.slides) && body.slides.length) {
    return [0, 1, 2].map((i) => {
      const slide = body.slides[i] || {};
      return {
        image_url: String(slide.image_url || '').trim(),
        heading: String(slide.heading || '').trim(),
        text: String(slide.text || '').trim(),
      };
    });
  }

  const images = Array.isArray(body?.images) ? body.images : [];
  const slideMeta = Array.isArray(body?.slide_meta) ? body.slide_meta : defaultSlideMeta();
  return [0, 1, 2].map((i) => ({
    image_url: String(images[i] || '').trim(),
    heading: String(slideMeta[i]?.heading || '').trim(),
    text: String(slideMeta[i]?.text || '').trim(),
  }));
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

  await saveSetting(KEYS.heading, heading);
  await saveSetting(KEYS.text, text);
  await saveSetting(KEYS.image1, slides[0].image_url);
  await saveSetting(KEYS.image2, slides[1].image_url);
  await saveSetting(KEYS.image3, slides[2].image_url);
  await saveSetting(
    KEYS.slideMeta,
    JSON.stringify(slides.map((s) => ({ heading: s.heading, text: s.text })))
  );

  const data = await readWhatsNewSettings();
  res.json({ message: "What's New updated.", ...data });
});

router.post('/admin/upload', authenticateAdmin, uploadImage.single('image'), async (req, res) => {
  const slot = parseInt(req.body?.slot, 10);
  if (![1, 2, 3].includes(slot)) {
    return res.status(400).json({ message: 'slot must be 1, 2, or 3.' });
  }
  if (!req.file) return res.status(400).json({ message: 'Image file is required.' });

  const { url } = await uploadFile(req.file.buffer, 'whats-new', {
    originalName: req.file.originalname,
  });

  const key = slot === 1 ? KEYS.image1 : slot === 2 ? KEYS.image2 : KEYS.image3;
  await saveSetting(key, url);
  const data = await readWhatsNewSettings();

  res.status(201).json({
    message: `Image ${slot} uploaded.`,
    image_url: url,
    ...data,
  });
});

export default router;
