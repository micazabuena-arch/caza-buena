import bcrypt from 'bcryptjs';
import pool from './database.js';

function adminCredentials() {
  return {
    email: process.env.ADMIN_EMAIL || 'admin@cazabuena.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
  };
}

function syncPasswordEnabled() {
  const v = process.env.ADMIN_SYNC_PASSWORD;
  return v === '1' || v === 'true';
}

/** Creates default admin user if none exists; optionally syncs password from env */
export async function seedAdminUser() {
  const { email, password } = adminCredentials();
  const hash = await bcrypt.hash(password, 12);

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

  if (existing.length > 0) {
    if (syncPasswordEnabled()) {
      await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, email]);
      console.log(`Admin password synced for ${email} (ADMIN_SYNC_PASSWORD)`);
    }
    return;
  }

  await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Caza Buena Admin', email, hash, 'admin']
  );
  console.log(`Default admin created: ${email}`);
}

const DEFAULT_MENU_ITEMS = [
  ['Beef Tapa', 'All Day Breakfast', 120, 1],
  ['Longganisa', 'All Day Breakfast', 110, 2],
  ['Tocino', 'All Day Breakfast', 110, 3],
  ['Hotdog', 'All Day Breakfast', 95, 4],
  ['Danggit', 'All Day Breakfast', 130, 5],
  ['Beef Tapa Rice Meal', 'Rice Meals', 150, 10],
  ['Longganisa Rice Meal', 'Rice Meals', 140, 11],
  ['Tocino Rice Meal', 'Rice Meals', 140, 12],
  ['Potato Wedge', 'Snacks & Extras', 80, 20],
  ['Fries', 'Snacks & Extras', 70, 21],
  ['Pasta', 'Snacks & Extras', 160, 22],
  ['Hot Coffee', 'Drinks', 50, 30],
  ['Iced Coffee', 'Drinks', 65, 31],
  ['Soft Drink', 'Drinks', 45, 32],
  ['Juice', 'Drinks', 55, 33],
];

/** Seeds café menu items when the table is empty */
export async function seedMenuItems() {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM menu_items');
    if (rows[0].count > 0) return;

    for (const [name, category, price, sort_order] of DEFAULT_MENU_ITEMS) {
      await pool.query(
        'INSERT INTO menu_items (name, category, price, sort_order) VALUES (?, ?, ?, ?)',
        [name, category, price, sort_order]
      );
    }
    console.log('Default menu items seeded');
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') return;
    throw e;
  }
}
