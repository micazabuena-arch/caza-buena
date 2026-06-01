import bcrypt from 'bcryptjs';
import pool from './database.js';

/** Creates default admin user if none exists */
export async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL || 'admin@cazabuena.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) return;

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Caza Buena Admin', email, hash, 'admin']
  );
  console.log(`Default admin created: ${email}`);
}
