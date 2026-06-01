import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// Admin route must be registered before /:slug
router.get('/admin/all', authenticateAdmin, async (_req, res) => {
  const [rooms] = await pool.query('SELECT * FROM rooms ORDER BY sort_order, name');
  for (const room of rooms) {
    const [images] = await pool.query(
      'SELECT id, image_url, is_primary, sort_order FROM room_images WHERE room_id = ? ORDER BY is_primary DESC, sort_order',
      [room.id]
    );
    room.images = images;
    try {
      room.amenities = room.amenities_json ? JSON.parse(room.amenities_json) : [];
    } catch {
      room.amenities = [];
    }
    delete room.amenities_json;
    const [holidays] = await pool.query(
      'SELECT id, label, start_date, end_date, price_per_night FROM room_holiday_rates WHERE room_id = ? ORDER BY start_date',
      [room.id]
    );
    room.holiday_rates = holidays;
  }
  res.json(rooms);
});

router.get('/', async (_req, res) => {
  const [rooms] = await pool.query(
    'SELECT * FROM rooms WHERE is_active = 1 ORDER BY sort_order, name'
  );
  for (const room of rooms) {
    const [images] = await pool.query(
      'SELECT id, image_url, is_primary FROM room_images WHERE room_id = ? ORDER BY is_primary DESC, sort_order',
      [room.id]
    );
    room.images = images;
    room.amenities = room.amenities_json ? JSON.parse(room.amenities_json) : [];
    delete room.amenities_json;
  }
  res.json(rooms);
});

router.get('/:slug', async (req, res) => {
  const [rooms] = await pool.query(
    'SELECT * FROM rooms WHERE slug = ? AND is_active = 1',
    [req.params.slug]
  );
  if (rooms.length === 0) return res.status(404).json({ message: 'Room not found' });

  const room = rooms[0];
  const [images] = await pool.query(
    'SELECT * FROM room_images WHERE room_id = ? ORDER BY is_primary DESC, sort_order',
    [room.id]
  );
  room.images = images;
  room.amenities = room.amenities_json ? JSON.parse(room.amenities_json) : [];
  delete room.amenities_json;
  res.json(room);
});

export default router;
