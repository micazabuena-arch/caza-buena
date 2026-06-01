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
      res.status(500).end();
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

export default router;
