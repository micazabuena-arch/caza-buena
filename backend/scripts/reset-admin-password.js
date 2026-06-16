/**
 * One-off: set admin password from ADMIN_EMAIL + ADMIN_PASSWORD in .env
 * Usage: node scripts/reset-admin-password.js
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool from '../src/config/database.js';

dotenv.config();

const email = process.env.ADMIN_EMAIL || 'admin@cazabuena.com';
const password = process.env.ADMIN_PASSWORD || 'Admin@12345';

async function main() {
  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [
    hash,
    email,
  ]);

  if (result.affectedRows === 0) {
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Caza Buena Admin', email, hash, 'admin']
    );
    console.log(`Admin created: ${email}`);
  } else {
    console.log(`Password updated for: ${email}`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
