import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, category, description, price, sort_order FROM menu_items WHERE is_active = 1 ORDER BY category, sort_order, name'
  );
  res.json(rows);
});

router.get('/admin/all', authenticateAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, category, description, price, sort_order, is_active FROM menu_items ORDER BY category, sort_order, name'
  );
  res.json(rows);
});

router.post('/admin', authenticateAdmin, async (req, res) => {
  const { name, category, description, price, sort_order, is_active } = req.body;
  if (!name?.trim() || !category?.trim()) {
    return res.status(400).json({ message: 'Name and category are required' });
  }
  const parsedPrice = Number(price);
  if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ message: 'Valid price is required' });
  }

  const [result] = await pool.query(
    `INSERT INTO menu_items (name, category, description, price, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      category.trim(),
      description?.trim() || null,
      parsedPrice,
      Number(sort_order) || 0,
      is_active === 0 || is_active === false ? 0 : 1,
    ]
  );

  const [rows] = await pool.query(
    'SELECT id, name, category, description, price, sort_order, is_active FROM menu_items WHERE id = ?',
    [result.insertId]
  );
  res.status(201).json(rows[0]);
});

router.put('/admin/:id', authenticateAdmin, async (req, res) => {
  const { name, category, description, price, sort_order, is_active } = req.body;
  const [existing] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
  if (!existing.length) return res.status(404).json({ message: 'Menu item not found' });

  const row = existing[0];
  const parsedPrice = price != null && price !== '' ? Number(price) : Number(row.price);
  if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ message: 'Valid price is required' });
  }

  await pool.query(
    `UPDATE menu_items SET name=?, category=?, description=?, price=?, sort_order=?, is_active=? WHERE id=?`,
    [
      (name ?? row.name).trim(),
      (category ?? row.category).trim(),
      description != null ? description.trim() || null : row.description,
      parsedPrice,
      sort_order != null ? Number(sort_order) : row.sort_order,
      is_active === 0 || is_active === false ? 0 : is_active === 1 || is_active === true ? 1 : row.is_active,
      req.params.id,
    ]
  );

  const [rows] = await pool.query(
    'SELECT id, name, category, description, price, sort_order, is_active FROM menu_items WHERE id = ?',
    [req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/admin/:id', authenticateAdmin, async (req, res) => {
  await pool.query('UPDATE menu_items SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Removed' });
});

export default router;
