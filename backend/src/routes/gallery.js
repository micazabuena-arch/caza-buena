import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadFile } from '../utils/fileUpload.js';

const router = Router();

router.get('/', async (req, res) => {
  const { category } = req.query;
  let query = 'SELECT * FROM gallery_images WHERE is_active = 1';
  const params = [];
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  query += ' ORDER BY sort_order';
  const [rows] = await pool.query(query, params);
  res.json(rows);
});

router.post('/admin', authenticateAdmin, uploadImage.single('image'), async (req, res) => {
  const { title, category } = req.body;
  if (!req.file) return res.status(400).json({ message: 'Image required' });

  const { url, publicId } = await uploadFile(req.file.buffer, 'gallery', {
    originalName: req.file.originalname,
  });
  const [insert] = await pool.query(
    'INSERT INTO gallery_images (title, image_url, cloudinary_public_id, category) VALUES (?, ?, ?, ?)',
    [title || null, url, publicId, category || 'general']
  );
  res.status(201).json({ id: insert.insertId, image_url: url });
});

router.delete('/admin/:id', authenticateAdmin, async (req, res) => {
  await pool.query('UPDATE gallery_images SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Removed' });
});

export default router;
