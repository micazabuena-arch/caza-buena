import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password, remember_me: rememberMe } = req.body;
      const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

      const user = users[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

      const expiresIn = rememberMe
        ? process.env.JWT_REMEMBER_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '30d'
        : process.env.JWT_SESSION_EXPIRES_IN || '8h';

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn }
      );

      res.json({
        token,
        expiresIn,
        rememberMe: Boolean(rememberMe),
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Server error during sign in. Check API database connection.' });
    }
  }
);

router.get('/me', authenticateAdmin, async (req, res) => {
  const [users] = await pool.query(
    'SELECT id, name, email, role FROM users WHERE id = ?',
    [req.user.id]
  );
  if (users.length === 0) return res.status(404).json({ message: 'User not found' });
  res.json(users[0]);
});

/** List admin panel accounts (no password hashes) */
router.get('/admins', authenticateAdmin, async (_req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(users);
  } catch (err) {
    console.error('List admins error:', err);
    res.status(500).json({ message: 'Could not load admin accounts' });
  }
});

/** Create a new admin panel login */
router.post(
  '/admins',
  authenticateAdmin,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(['admin', 'staff']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, email, password, role = 'admin' } = req.body;
      const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ message: 'An account with this email already exists' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const [result] = await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name.trim(), email, password_hash, role]
      );

      res.status(201).json({
        id: result.insertId,
        name: name.trim(),
        email,
        role,
      });
    } catch (err) {
      console.error('Create admin error:', err);
      res.status(500).json({ message: 'Could not create admin account' });
    }
  }
);

/** Change password for the signed-in admin */
router.patch(
  '/me/password',
  authenticateAdmin,
  [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 8 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { current_password: currentPassword, new_password: newPassword } = req.body;
      const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      if (users.length === 0) return res.status(404).json({ message: 'User not found' });

      const valid = await bcrypt.compare(currentPassword, users[0].password_hash);
      if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

      const password_hash = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.user.id]);

      res.json({ message: 'Password updated' });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ message: 'Could not update password' });
    }
  }
);

export default router;
