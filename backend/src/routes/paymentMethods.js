import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin, requireAdminRole } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadFile } from '../utils/fileUpload.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, type, account_name, account_number, qr_image_url, instructions FROM payment_methods WHERE is_active = 1 ORDER BY sort_order'
  );
  res.json(rows);
});

// Admin: list all payment methods (including inactive)
router.get('/admin/all', authenticateAdmin, async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM payment_methods ORDER BY sort_order');
  res.json(rows);
});

// Payment methods hold bank / e-wallet account details — admin-only to configure.
router.post('/admin', authenticateAdmin, requireAdminRole, uploadImage.single('qr'), async (req, res) => {
  const { name, type, account_name, account_number, instructions, is_active, sort_order } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

  const allowedTypes = ['gcash', 'maya', 'bdo', 'bpi', 'other'];
  const methodType = allowedTypes.includes(type) ? type : 'other';

  let qrUrl = null;
  if (req.file) {
    const { url } = await uploadFile(req.file.buffer, 'qr-codes', {
      originalName: req.file.originalname,
    });
    qrUrl = url;
  }

  const [result] = await pool.query(
    `INSERT INTO payment_methods (name, type, account_name, account_number, qr_image_url, instructions, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      methodType,
      account_name?.trim() || null,
      account_number?.trim() || null,
      qrUrl,
      instructions?.trim() || null,
      is_active === 'false' || is_active === false || is_active === '0' ? 0 : 1,
      parseInt(sort_order, 10) || 0,
    ]
  );

  const [rows] = await pool.query('SELECT * FROM payment_methods WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

router.put('/admin/:id', authenticateAdmin, requireAdminRole, uploadImage.single('qr'), async (req, res) => {
  const { name, account_name, account_number, instructions, is_active } = req.body;
  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (account_name !== undefined) { updates.push('account_name = ?'); params.push(account_name); }
  if (account_number !== undefined) { updates.push('account_number = ?'); params.push(account_number); }
  if (instructions !== undefined) { updates.push('instructions = ?'); params.push(instructions); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active === 'true' || is_active === true || is_active === '1' ? 1 : 0); }

  if (req.file) {
    const { url } = await uploadFile(req.file.buffer, 'qr-codes', {
      originalName: req.file.originalname,
    });
    updates.push('qr_image_url = ?');
    params.push(url);
  }

  if (updates.length === 0) return res.status(400).json({ message: 'No updates provided' });
  params.push(req.params.id);
  await pool.query(`UPDATE payment_methods SET ${updates.join(', ')} WHERE id = ?`, params);
  const [rows] = await pool.query('SELECT * FROM payment_methods WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

router.delete('/admin/:id', authenticateAdmin, requireAdminRole, async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM payment_methods WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Payment method not found' });

  await pool.query('DELETE FROM payment_methods WHERE id = ?', [req.params.id]);
  res.json({ message: 'Payment method removed', id: Number(req.params.id) });
});

export default router;
