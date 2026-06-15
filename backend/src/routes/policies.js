import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

function slugify(title) {
  return (
    String(title)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'policy'
  );
}

router.get('/', async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM policies WHERE is_active = 1 ORDER BY sort_order'
  );
  res.json(rows);
});

router.post('/admin', authenticateAdmin, async (req, res) => {
  const { title, content, sort_order } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: 'Title and content are required' });
  }

  let slug = slugify(title);
  const [taken] = await pool.query('SELECT id FROM policies WHERE slug = ?', [slug]);
  if (taken.length) slug = `${slug}-${Date.now()}`;

  const [result] = await pool.query(
    'INSERT INTO policies (title, slug, content, sort_order, is_active) VALUES (?, ?, ?, ?, 1)',
    [title.trim(), slug, content.trim(), Number(sort_order) || 0]
  );

  const [rows] = await pool.query('SELECT * FROM policies WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

router.put('/admin/:id', authenticateAdmin, async (req, res) => {
  const { title, content, is_active, sort_order } = req.body;
  const [existing] = await pool.query('SELECT * FROM policies WHERE id = ?', [req.params.id]);
  if (!existing.length) return res.status(404).json({ message: 'Policy not found' });

  const row = existing[0];
  await pool.query(
    'UPDATE policies SET title=?, content=?, is_active=?, sort_order=? WHERE id=?',
    [
      (title ?? row.title).trim(),
      (content ?? row.content).trim(),
      is_active ?? row.is_active,
      sort_order != null ? Number(sort_order) : row.sort_order,
      req.params.id,
    ]
  );

  const [rows] = await pool.query('SELECT * FROM policies WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

export default router;
