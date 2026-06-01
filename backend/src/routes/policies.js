import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM policies WHERE is_active = 1 ORDER BY sort_order'
  );
  res.json(rows);
});

router.put('/admin/:id', authenticateAdmin, async (req, res) => {
  const { title, content, is_active } = req.body;
  await pool.query(
    'UPDATE policies SET title=?, content=?, is_active=? WHERE id=?',
    [title, content, is_active ?? 1, req.params.id]
  );
  res.json({ message: 'Updated' });
});

export default router;
