import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateAdmin, requireAdminRole } from '../middleware/auth.js';

const router = Router();

const ADMIN_SELECT =
  'SELECT id, name, email, role, COALESCE(is_active, 1) AS is_active, created_at FROM users';

async function countActiveAdmins(excludeId = null) {
  let sql = `SELECT COUNT(*) AS c FROM users
    WHERE role = 'admin' AND COALESCE(is_active, 1) = 1`;
  const params = [];
  if (excludeId != null) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(sql, params);
  return Number(rows[0].c);
}

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
      if (user.is_active != null && !Number(user.is_active)) {
        return res.status(403).json({ message: 'This account has been deactivated' });
      }

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
    'SELECT id, name, email, role, COALESCE(is_active, 1) AS is_active FROM users WHERE id = ?',
    [req.user.id]
  );
  if (users.length === 0) return res.status(404).json({ message: 'User not found' });
  res.json(users[0]);
});

/** List admin panel accounts (no password hashes) */
router.get('/admins', authenticateAdmin, async (_req, res) => {
  try {
    const [users] = await pool.query(`${ADMIN_SELECT} ORDER BY created_at ASC`);
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
  requireAdminRole,
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
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)',
        [name.trim(), email, password_hash, role]
      );

      res.status(201).json({
        id: result.insertId,
        name: name.trim(),
        email,
        role,
        is_active: 1,
      });
    } catch (err) {
      console.error('Create admin error:', err);
      res.status(500).json({ message: 'Could not create admin account' });
    }
  }
);

/**
 * Update an admin panel account (name, email, role, optional password, active flag).
 * Admins cannot deactivate or demote themselves if they are the last active admin.
 */
router.patch(
  '/admins/:id',
  authenticateAdmin,
  requireAdminRole,
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'staff']),
    body('password').optional({ values: 'falsy' }).isLength({ min: 8 }),
    body('is_active').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const targetId = parseInt(req.params.id, 10);
    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ message: 'Invalid account id' });
    }

    try {
      const [rows] = await pool.query(`${ADMIN_SELECT} WHERE id = ?`, [targetId]);
      if (rows.length === 0) return res.status(404).json({ message: 'Account not found' });

      const existing = rows[0];
      const {
        name = existing.name,
        email = existing.email,
        role = existing.role,
        password,
        is_active: isActiveBody,
      } = req.body;

      const nextActive =
        isActiveBody === undefined
          ? Number(existing.is_active)
          : isActiveBody === true || isActiveBody === 1 || isActiveBody === '1'
            ? 1
            : 0;

      // Cannot deactivate your own account while signed in.
      if (targetId === req.user.id && nextActive === 0) {
        return res.status(400).json({ message: 'You cannot deactivate your own account' });
      }

      // Keep at least one active admin who can manage the panel.
      const wouldLoseAdminAccess =
        existing.role === 'admin' &&
        Number(existing.is_active) === 1 &&
        (nextActive === 0 || role !== 'admin');
      if (wouldLoseAdminAccess) {
        const remaining = await countActiveAdmins(targetId);
        if (remaining < 1) {
          return res.status(400).json({
            message: 'Cannot deactivate or demote the last active admin account',
          });
        }
      }

      if (email !== existing.email) {
        const [dup] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [
          email,
          targetId,
        ]);
        if (dup.length > 0) {
          return res.status(409).json({ message: 'An account with this email already exists' });
        }
      }

      const updates = ['name = ?', 'email = ?', 'role = ?', 'is_active = ?'];
      const params = [String(name).trim(), email, role, nextActive];

      if (password) {
        updates.push('password_hash = ?');
        params.push(await bcrypt.hash(password, 12));
      }

      params.push(targetId);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

      const [updated] = await pool.query(`${ADMIN_SELECT} WHERE id = ?`, [targetId]);
      res.json(updated[0]);
    } catch (err) {
      console.error('Update admin error:', err);
      res.status(500).json({ message: 'Could not update admin account' });
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
