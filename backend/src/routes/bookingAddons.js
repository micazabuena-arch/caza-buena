import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = Router();

// Get all add-ons for a booking
router.get('/booking/:bookingId', authenticateAdmin, async (req, res) => {
  try {
    const [addons] = await pool.query(
      'SELECT * FROM booking_addons WHERE booking_id = ? ORDER BY sort_order, created_at',
      [req.params.bookingId]
    );
    res.json(addons);
  } catch (err) {
    console.error('Error fetching booking add-ons:', err);
    res.status(500).json({ message: 'Unable to fetch add-ons' });
  }
});

// Create a new add-on for a booking
router.post('/booking/:bookingId', authenticateAdmin, async (req, res) => {
  try {
    const { label, description, amount, show_in_soa, sort_order } = req.body;
    
    if (!label || !label.trim()) {
      return res.status(400).json({ message: 'Label is required' });
    }
    
    const addonAmount = parseFloat(amount) || 0;
    const showInSoa = show_in_soa !== undefined ? (show_in_soa ? 1 : 0) : 1;
    const sortOrder = parseInt(sort_order) || 0;
    
    const [result] = await pool.query(
      `INSERT INTO booking_addons (booking_id, label, description, amount, show_in_soa, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.bookingId, label.trim(), description?.trim() || null, addonAmount, showInSoa, sortOrder]
    );
    
    const [newAddon] = await pool.query('SELECT * FROM booking_addons WHERE id = ?', [result.insertId]);
    res.status(201).json(newAddon[0]);
  } catch (err) {
    console.error('Error creating booking add-on:', err);
    res.status(500).json({ message: 'Unable to create add-on' });
  }
});

// Update an add-on
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { label, description, amount, show_in_soa, sort_order } = req.body;
    
    if (!label || !label.trim()) {
      return res.status(400).json({ message: 'Label is required' });
    }
    
    const addonAmount = parseFloat(amount) || 0;
    const showInSoa = show_in_soa !== undefined ? (show_in_soa ? 1 : 0) : 1;
    const sortOrder = parseInt(sort_order) || 0;
    
    await pool.query(
      `UPDATE booking_addons 
       SET label = ?, description = ?, amount = ?, show_in_soa = ?, sort_order = ?
       WHERE id = ?`,
      [label.trim(), description?.trim() || null, addonAmount, showInSoa, sortOrder, req.params.id]
    );
    
    const [updated] = await pool.query('SELECT * FROM booking_addons WHERE id = ?', [req.params.id]);
    if (updated.length === 0) {
      return res.status(404).json({ message: 'Add-on not found' });
    }
    
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating booking add-on:', err);
    res.status(500).json({ message: 'Unable to update add-on' });
  }
});

// Delete an add-on
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM booking_addons WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Add-on not found' });
    }
    res.json({ message: 'Add-on deleted' });
  } catch (err) {
    console.error('Error deleting booking add-on:', err);
    res.status(500).json({ message: 'Unable to delete add-on' });
  }
});

export default router;
