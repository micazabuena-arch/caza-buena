import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = Router();

/** Adjust booking total when a custom add-on amount changes.
 *  Do not bump amount_to_pay — that field tracks recorded payments / pay-now. */
async function adjustBookingTotals(bookingId, delta) {
  const amount = Math.round(Number(delta) * 100) / 100;
  if (!bookingId || !Number.isFinite(amount) || amount === 0) return;

  await pool.query(
    `UPDATE bookings
     SET total_amount = GREATEST(0, total_amount + ?)
     WHERE id = ?`,
    [amount, bookingId]
  );
}

async function loadBookingWithAddons(bookingId) {
  const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!rows.length) return null;
  const [addons] = await pool.query(
    'SELECT * FROM booking_addons WHERE booking_id = ? ORDER BY sort_order, created_at',
    [bookingId]
  );
  return { ...rows[0], addons: addons || [] };
}

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
    const bookingId = req.params.bookingId;
    const { label, description, amount, include_in_soa, include_in_confirmation, sort_order } =
      req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ message: 'Label is required' });
    }

    const [[booking]] = await pool.query('SELECT id FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const addonAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;
    const includeInSoa = include_in_soa !== undefined ? (include_in_soa ? 1 : 0) : 1;
    const includeInConfirmation =
      include_in_confirmation !== undefined ? (include_in_confirmation ? 1 : 0) : 1;
    const sortOrder = parseInt(sort_order, 10) || 0;

    const [result] = await pool.query(
      `INSERT INTO booking_addons (booking_id, label, description, amount, include_in_soa, include_in_confirmation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingId,
        label.trim(),
        description?.trim() || null,
        addonAmount,
        includeInSoa,
        includeInConfirmation,
        sortOrder,
      ]
    );

    await adjustBookingTotals(bookingId, addonAmount);

    const [newAddon] = await pool.query('SELECT * FROM booking_addons WHERE id = ?', [
      result.insertId,
    ]);
    const updatedBooking = await loadBookingWithAddons(bookingId);
    res.status(201).json({ ...newAddon[0], booking: updatedBooking });
  } catch (err) {
    console.error('Error creating booking add-on:', err);
    res.status(500).json({ message: 'Unable to create add-on' });
  }
});

// Update an add-on
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { label, description, amount, include_in_soa, include_in_confirmation, sort_order } =
      req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ message: 'Label is required' });
    }

    const [existingRows] = await pool.query('SELECT * FROM booking_addons WHERE id = ?', [
      req.params.id,
    ]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'Add-on not found' });
    }
    const existing = existingRows[0];

    const addonAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;
    const includeInSoa = include_in_soa !== undefined ? (include_in_soa ? 1 : 0) : 1;
    const includeInConfirmation =
      include_in_confirmation !== undefined ? (include_in_confirmation ? 1 : 0) : 1;
    const sortOrder = parseInt(sort_order, 10) || 0;

    await pool.query(
      `UPDATE booking_addons
       SET label = ?, description = ?, amount = ?, include_in_soa = ?, include_in_confirmation = ?, sort_order = ?
       WHERE id = ?`,
      [
        label.trim(),
        description?.trim() || null,
        addonAmount,
        includeInSoa,
        includeInConfirmation,
        sortOrder,
        req.params.id,
      ]
    );

    await adjustBookingTotals(existing.booking_id, addonAmount - Number(existing.amount || 0));

    const [updated] = await pool.query('SELECT * FROM booking_addons WHERE id = ?', [req.params.id]);
    const updatedBooking = await loadBookingWithAddons(existing.booking_id);
    res.json({ ...updated[0], booking: updatedBooking });
  } catch (err) {
    console.error('Error updating booking add-on:', err);
    res.status(500).json({ message: 'Unable to update add-on' });
  }
});

// Delete an add-on
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const [existingRows] = await pool.query('SELECT * FROM booking_addons WHERE id = ?', [
      req.params.id,
    ]);
    if (!existingRows.length) {
      return res.status(404).json({ message: 'Add-on not found' });
    }
    const existing = existingRows[0];

    await pool.query('DELETE FROM booking_addons WHERE id = ?', [req.params.id]);
    await adjustBookingTotals(existing.booking_id, -Number(existing.amount || 0));

    const updatedBooking = await loadBookingWithAddons(existing.booking_id);
    res.json({ message: 'Add-on deleted', booking: updatedBooking });
  } catch (err) {
    console.error('Error deleting booking add-on:', err);
    res.status(500).json({ message: 'Unable to delete add-on' });
  }
});

export default router;
