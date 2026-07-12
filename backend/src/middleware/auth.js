import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export async function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

    // Re-check DB so deactivated accounts lose access even with an old JWT.
    const [users] = await pool.query(
      'SELECT id, email, role, COALESCE(is_active, 1) AS is_active FROM users WHERE id = ?',
      [decoded.id]
    );
    if (users.length === 0 || !Number(users[0].is_active)) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    req.user = {
      id: users[0].id,
      email: users[0].email,
      role: users[0].role,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/** Only full admins may manage accounts, site pricing, and related settings. */
export function requireAdminRole(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can perform this action' });
  }
  next();
}
