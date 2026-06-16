import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { sendContactNotification } from '../services/email.js';

const router = Router();

router.post(
  '/',
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('message').trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, phone, subject, message } = req.body;
    const [result] = await pool.query(
      'INSERT INTO contact_inquiries (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || null, subject || null, message]
    );

    const inquiry = { id: result.insertId, name, email, message };
    const emailResult = await sendContactNotification(inquiry);
    if (!emailResult.sent) {
      console.warn('[Contact] Notification email not sent:', emailResult.reason, emailResult.hint || '');
    }

    res.status(201).json({
      message: 'Thank you! We will get back to you soon.',
      email_sent: emailResult.sent,
    });
  }
);

router.get('/admin', authenticateAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 100'
  );
  res.json(rows);
});

router.patch('/admin/:id/read', authenticateAdmin, async (req, res) => {
  await pool.query('UPDATE contact_inquiries SET is_read = 1 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Marked as read' });
});

export default router;
