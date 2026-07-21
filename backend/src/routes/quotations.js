import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

function generateQuotationReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = uuidv4().slice(0, 4).toUpperCase();
  return `QT-${date}-${suffix}`;
}

function parseQuoteRow(row) {
  if (!row) return row;
  let quote_data = row.quote_data;
  if (typeof quote_data === 'string') {
    try {
      quote_data = JSON.parse(quote_data);
    } catch {
      quote_data = null;
    }
  }
  return { ...row, quote_data };
}

/** List saved quotations (newest first). */
router.get('/admin', authenticateAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, reference_code, guest_name, grand_total, booking_id, created_at, updated_at
     FROM quotations
     ORDER BY updated_at DESC`
  );
  res.json(rows);
});

/** Load one saved quotation for editing. */
router.get('/admin/:id', authenticateAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM quotations WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Quotation not found' });
  res.json(parseQuoteRow(rows[0]));
});

/** Save a new quotation. */
router.post('/admin', authenticateAdmin, async (req, res) => {
  const { quote_data, grand_total, guest_name, booking_id } = req.body;
  if (!quote_data || typeof quote_data !== 'object') {
    return res.status(400).json({ message: 'quote_data is required' });
  }

  const reference = generateQuotationReference();
  const name = String(guest_name || quote_data.guestName || 'Untitled quote').trim() || 'Untitled quote';
  const total = parseFloat(grand_total);

  const [result] = await pool.query(
    `INSERT INTO quotations (reference_code, guest_name, booking_id, quote_data, grand_total, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      reference,
      name,
      booking_id || null,
      JSON.stringify(quote_data),
      Number.isFinite(total) ? total : 0,
      req.user.id,
    ]
  );

  res.status(201).json({ id: result.insertId, reference_code: reference });
});

/** Update an existing quotation. */
router.put('/admin/:id', authenticateAdmin, async (req, res) => {
  const { quote_data, grand_total, guest_name, booking_id } = req.body;
  if (!quote_data || typeof quote_data !== 'object') {
    return res.status(400).json({ message: 'quote_data is required' });
  }

  const [existing] = await pool.query('SELECT id FROM quotations WHERE id = ?', [req.params.id]);
  if (!existing.length) return res.status(404).json({ message: 'Quotation not found' });

  const name = String(guest_name || quote_data.guestName || 'Untitled quote').trim() || 'Untitled quote';
  const total = parseFloat(grand_total);

  await pool.query(
    `UPDATE quotations
     SET guest_name = ?, booking_id = ?, quote_data = ?, grand_total = ?
     WHERE id = ?`,
    [
      name,
      booking_id || null,
      JSON.stringify(quote_data),
      Number.isFinite(total) ? total : 0,
      req.params.id,
    ]
  );

  res.json({ message: 'Updated' });
});

/** Permanently delete a saved quotation. */
router.delete('/admin/:id', authenticateAdmin, async (req, res) => {
  const [result] = await pool.query('DELETE FROM quotations WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Quotation not found' });
  }
  res.json({ message: 'Deleted' });
});

export default router;
