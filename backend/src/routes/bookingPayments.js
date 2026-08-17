import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import pool from '../config/database.js';
import {
  attachBookingPayments,
  deleteBookingPayment,
  insertBookingPayment,
  listBookingPayments,
  updateBookingPayment,
} from '../utils/bookingPayments.js';

const router = Router();

async function loadBookingWithPayments(bookingId) {
  const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!rows.length) return null;
  return attachBookingPayments(pool, rows[0]);
}

// List recorded payments for a booking
router.get('/booking/:bookingId', authenticateAdmin, async (req, res) => {
  try {
    const [[booking]] = await pool.query('SELECT id FROM bookings WHERE id = ?', [
      req.params.bookingId,
    ]);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const payments = await listBookingPayments(pool, req.params.bookingId);
    res.json(payments);
  } catch (err) {
    console.error('Error fetching booking payments:', err);
    res.status(500).json({ message: 'Unable to fetch payments' });
  }
});

// Append a payment (DP / partial / full / custom)
router.post('/booking/:bookingId', authenticateAdmin, async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const [[booking]] = await pool.query('SELECT id FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const created = await insertBookingPayment(pool, bookingId, {
      payment_type: req.body.payment_type,
      amount: req.body.amount,
      note: req.body.note,
      paid_at: req.body.paid_at,
    });
    if (created?.error) return res.status(400).json({ message: created.error });

    const updatedBooking = await loadBookingWithPayments(bookingId);
    res.status(201).json({ ...created, booking: updatedBooking });
  } catch (err) {
    console.error('Error creating booking payment:', err);
    res.status(500).json({ message: 'Unable to create payment' });
  }
});

router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const updated = await updateBookingPayment(pool, req.params.id, {
      payment_type: req.body.payment_type,
      amount: req.body.amount,
      note: req.body.note,
      paid_at: req.body.paid_at,
    });
    if (updated?.error) {
      return res.status(updated.status || 400).json({ message: updated.error });
    }

    const updatedBooking = await loadBookingWithPayments(updated.booking_id);
    res.json({ ...updated, booking: updatedBooking });
  } catch (err) {
    console.error('Error updating booking payment:', err);
    res.status(500).json({ message: 'Unable to update payment' });
  }
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await deleteBookingPayment(pool, req.params.id);
    if (result?.error) {
      return res.status(result.status || 400).json({ message: result.error });
    }

    const updatedBooking = await loadBookingWithPayments(result.booking_id);
    res.json({ message: 'Payment deleted', booking: updatedBooking });
  } catch (err) {
    console.error('Error deleting booking payment:', err);
    res.status(500).json({ message: 'Unable to delete payment' });
  }
});

export default router;
