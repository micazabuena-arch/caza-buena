import { Router } from 'express';
import pool from '../config/database.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM amenities WHERE is_active = 1 ORDER BY sort_order'
  );
  res.json(rows);
});

export default router;
