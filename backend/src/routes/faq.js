import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM faqs WHERE is_active = 1 ORDER BY sort_order'
  );
  res.json(rows);
});

router.post('/admin', authenticateAdmin, async (req, res) => {
  const { question, answer, category, sort_order } = req.body;
  const [r] = await pool.query(
    'INSERT INTO faqs (question, answer, category, sort_order) VALUES (?, ?, ?, ?)',
    [question, answer, category || 'general', sort_order || 0]
  );
  res.status(201).json({ id: r.insertId });
});

router.put('/admin/:id', authenticateAdmin, async (req, res) => {
  const { question, answer, category, is_active, sort_order } = req.body;
  await pool.query(
    'UPDATE faqs SET question=?, answer=?, category=?, is_active=?, sort_order=? WHERE id=?',
    [question, answer, category, is_active ?? 1, sort_order ?? 0, req.params.id]
  );
  res.json({ message: 'Updated' });
});

export default router;
