import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateAdmin, requireAdminRole } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadFile } from '../utils/fileUpload.js';

const router = Router();

// Dashboard stats
router.get('/dashboard', authenticateAdmin, async (_req, res) => {
  const [[pending]] = await pool.query(
    "SELECT COUNT(*) as count FROM bookings WHERE status IN ('pending','awaiting_payment','payment_submitted')"
  );
  const [[confirmed]] = await pool.query(
    "SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'"
  );
  const [[revenue]] = await pool.query(
    "SELECT COALESCE(SUM(total_amount),0) as total FROM bookings WHERE status = 'confirmed'"
  );
  const [[inquiries]] = await pool.query(
    'SELECT COUNT(*) as count FROM contact_inquiries WHERE is_read = 0'
  );
  const [[awaitingProof]] = await pool.query(
    "SELECT COUNT(*) as count FROM bookings WHERE status = 'payment_submitted'"
  );
  const [recent] = await pool.query(
    `SELECT b.reference_code, b.guest_name, b.check_in, b.status, r.name as room_name
     FROM bookings b JOIN rooms r ON b.room_id = r.id
     ORDER BY b.created_at DESC LIMIT 5`
  );

  res.json({
    stats: {
      pending_bookings: pending.count,
      confirmed_bookings: confirmed.count,
      total_revenue: revenue.total,
      unread_inquiries: inquiries.count,
      awaiting_payment_verification: awaitingProof.count,
    },
    recent_bookings: recent,
  });
});

// Discounts CRUD
router.get('/discounts', authenticateAdmin, async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM discounts ORDER BY created_at DESC');
  res.json(rows);
});

router.post('/discounts', authenticateAdmin, requireAdminRole, async (req, res) => {
  const { code, description, type, value, min_nights, valid_from, valid_until, max_uses } = req.body;
  const [r] = await pool.query(
    `INSERT INTO discounts (code, description, type, value, min_nights, valid_from, valid_until, max_uses)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [code.toUpperCase(), description, type, value, min_nights || 1, valid_from, valid_until, max_uses]
  );
  res.status(201).json({ id: r.insertId });
});

router.patch('/discounts/:id', authenticateAdmin, requireAdminRole, async (req, res) => {
  const { is_active } = req.body;
  await pool.query('UPDATE discounts SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
  res.json({ message: 'Updated' });
});

// Room availability blocks
router.get('/availability/:roomId', authenticateAdmin, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM room_unavailability WHERE room_id = ? ORDER BY start_date',
    [req.params.roomId]
  );
  res.json(rows);
});

router.post('/availability', authenticateAdmin, async (req, res) => {
  const { room_id, start_date, end_date, reason } = req.body;
  const [r] = await pool.query(
    'INSERT INTO room_unavailability (room_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)',
    [room_id, start_date, end_date, reason || null]
  );
  res.status(201).json({ id: r.insertId });
});

router.delete('/availability/:id', authenticateAdmin, async (req, res) => {
  await pool.query('DELETE FROM room_unavailability WHERE id = ?', [req.params.id]);
  res.json({ message: 'Removed' });
});

// Rooms management
router.get('/rooms/:id', authenticateAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ message: 'Room not found' });
  const room = rows[0];
  const [images] = await pool.query(
    'SELECT * FROM room_images WHERE room_id = ? ORDER BY is_primary DESC, sort_order',
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
    'SELECT * FROM room_holiday_rates WHERE room_id = ? ORDER BY start_date',
    [room.id]
  );
  room.holiday_rates = holidays;
  res.json(room);
});

router.post('/rooms', authenticateAdmin, requireAdminRole, async (req, res) => {
  const {
    name,
    slug,
    description,
    short_description,
    capacity,
    price_per_night,
    price_weekend,
    amenities,
    is_active,
    sort_order,
  } = req.body;

  if (!name?.trim() || !slug?.trim()) {
    return res.status(400).json({ message: 'Name and slug are required' });
  }

  const [existing] = await pool.query('SELECT id FROM rooms WHERE slug = ?', [slug]);
  if (existing.length > 0) {
    return res.status(409).json({ message: 'Slug already in use. Choose a different URL slug.' });
  }

  const { room_type = 'queen', included_adults, min_guests, max_guests } = req.body;
  const maxGuests = parseInt(max_guests ?? capacity, 10) || 2;
  const minGuests = Math.min(parseInt(min_guests, 10) || 1, maxGuests);

  const [r] = await pool.query(
    `INSERT INTO rooms (name, room_type, slug, description, short_description, capacity, included_adults, min_guests, max_guests, price_per_night, price_weekend, amenities_json, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      room_type === 'suite' ? 'suite' : 'queen',
      slug.trim(),
      description || null,
      short_description || null,
      maxGuests,
      included_adults ?? maxGuests,
      minGuests,
      maxGuests,
      price_per_night,
      price_weekend ?? price_per_night,
      JSON.stringify(Array.isArray(amenities) ? amenities : []),
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      sort_order || 0,
    ]
  );
  res.status(201).json({ id: r.insertId, message: 'Room created' });
});

router.put('/rooms/:id', authenticateAdmin, async (req, res) => {
  // Staff may update room details, but not site-wide nightly rates.
  const fields = { ...req.body };
  if (req.user?.role !== 'admin') {
    delete fields.price_per_night;
    delete fields.price_weekend;
  }
  const allowed = [
    'name',
    'room_type',
    'slug',
    'description',
    'short_description',
    'capacity',
    'included_adults',
    'min_guests',
    'max_guests',
    'price_per_night',
    'price_weekend',
    'is_active',
    'sort_order',
  ];
  const updates = [];
  const params = [];

  if (fields.slug) {
    const [dup] = await pool.query('SELECT id FROM rooms WHERE slug = ? AND id != ?', [fields.slug, req.params.id]);
    if (dup.length > 0) return res.status(409).json({ message: 'Slug already in use' });
  }

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      let val = fields[key];
      if (key === 'is_active') val = val ? 1 : 0;
      params.push(val);
    }
  }

  // Keep capacity in sync with max_guests for legacy queries
  if (fields.max_guests !== undefined) {
    updates.push('capacity = ?');
    params.push(parseInt(fields.max_guests, 10) || 2);
  } else if (fields.capacity !== undefined && fields.max_guests === undefined) {
    updates.push('max_guests = ?');
    params.push(parseInt(fields.capacity, 10) || 2);
  }
  if (fields.amenities !== undefined) {
    updates.push('amenities_json = ?');
    params.push(JSON.stringify(Array.isArray(fields.amenities) ? fields.amenities : []));
  }

  if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

  params.push(req.params.id);
  await pool.query(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`, params);

  const [rows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  res.json({ message: 'Updated', room: rows[0] });
});

router.delete('/rooms/:id', authenticateAdmin, async (req, res) => {
  const roomId = req.params.id;
  const [room] = await pool.query('SELECT id, name FROM rooms WHERE id = ?', [roomId]);
  if (room.length === 0) return res.status(404).json({ message: 'Room not found' });

  const [bookings] = await pool.query('SELECT COUNT(*) AS n FROM bookings WHERE room_id = ?', [roomId]);
  if (bookings[0].n > 0) {
    return res.status(409).json({
      message: `Cannot delete "${room[0].name}" — ${bookings[0].n} booking(s) use this room. Set it to Inactive instead.`,
    });
  }

  await pool.query('DELETE FROM rooms WHERE id = ?', [roomId]);
  res.json({ message: 'Room deleted' });
});

// Holiday / peak pricing per room
router.get('/rooms/:roomId/holidays', authenticateAdmin, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM room_holiday_rates WHERE room_id = ? ORDER BY start_date',
    [req.params.roomId]
  );
  res.json(rows);
});

router.post('/rooms/:roomId/holidays', authenticateAdmin, requireAdminRole, async (req, res) => {
  const { label, start_date, end_date, price_per_night } = req.body;
  if (!label || !start_date || !end_date || price_per_night == null) {
    return res.status(400).json({ message: 'label, start_date, end_date, price_per_night required' });
  }
  const [r] = await pool.query(
    'INSERT INTO room_holiday_rates (room_id, label, start_date, end_date, price_per_night) VALUES (?, ?, ?, ?, ?)',
    [req.params.roomId, label, start_date, end_date, price_per_night]
  );
  res.status(201).json({ id: r.insertId });
});

router.put('/rooms/:roomId/holidays/:id', authenticateAdmin, requireAdminRole, async (req, res) => {
  const { label, start_date, end_date, price_per_night } = req.body;
  await pool.query(
    'UPDATE room_holiday_rates SET label=?, start_date=?, end_date=?, price_per_night=? WHERE id=? AND room_id=?',
    [label, start_date, end_date, price_per_night, req.params.id, req.params.roomId]
  );
  res.json({ message: 'Updated' });
});

router.delete('/rooms/:roomId/holidays/:id', authenticateAdmin, requireAdminRole, async (req, res) => {
  await pool.query('DELETE FROM room_holiday_rates WHERE id=? AND room_id=?', [
    req.params.id,
    req.params.roomId,
  ]);
  res.json({ message: 'Deleted' });
});

router.post('/rooms/:id/images', authenticateAdmin, uploadImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Image required' });

  const roomId = req.params.id;
  const setPrimary = req.body.is_primary === 'true' || req.body.is_primary === true || req.body.is_primary === '1';

  if (setPrimary) {
    await pool.query('UPDATE room_images SET is_primary = 0 WHERE room_id = ?', [roomId]);
  }

  const { url, publicId } = await uploadFile(req.file.buffer, 'rooms', {
    originalName: req.file.originalname,
  });

  const [countRows] = await pool.query(
    'SELECT COUNT(*) as count FROM room_images WHERE room_id = ?',
    [roomId]
  );
  const imageCount = countRows[0]?.count ?? 0;
  const isPrimary = setPrimary || imageCount === 0 ? 1 : 0;

  const [r] = await pool.query(
    'INSERT INTO room_images (room_id, image_url, cloudinary_public_id, is_primary) VALUES (?, ?, ?, ?)',
    [roomId, url, publicId, isPrimary]
  );
  res.status(201).json({ id: r.insertId, image_url: url, is_primary: isPrimary });
});

router.delete('/rooms/:id/images/:imageId', authenticateAdmin, async (req, res) => {
  await pool.query('DELETE FROM room_images WHERE id = ? AND room_id = ?', [
    req.params.imageId,
    req.params.id,
  ]);
  res.json({ message: 'Image removed' });
});

router.patch('/rooms/:id/images/:imageId/primary', authenticateAdmin, async (req, res) => {
  await pool.query('UPDATE room_images SET is_primary = 0 WHERE room_id = ?', [req.params.id]);
  await pool.query('UPDATE room_images SET is_primary = 1 WHERE id = ? AND room_id = ?', [
    req.params.imageId,
    req.params.id,
  ]);
  res.json({ message: 'Primary image updated' });
});

// Site settings
router.get('/settings', async (_req, res) => {
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM site_settings');
  const settings = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  res.json(settings);
});

router.put('/settings', authenticateAdmin, requireAdminRole, async (req, res) => {
  const { validateExtraPersonRatesInput } = await import('../utils/extraPersonRates.js');
  const { errors, parsed } = validateExtraPersonRatesInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: errors[0] });
  }

  const entries = { ...req.body, ...parsed };

  for (const [key, value] of Object.entries(entries)) {
    await pool.query(
      'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [key, value, value]
    );
  }
  res.json({ message: 'Settings saved' });
});

// Guest list — one row per email (any booking history)
router.get('/guests', authenticateAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT b.guest_email,
            (SELECT guest_name FROM bookings b2
             WHERE b2.guest_email = b.guest_email
             ORDER BY b2.created_at DESC LIMIT 1) AS guest_name,
            (SELECT guest_phone FROM bookings b2
             WHERE b2.guest_email = b.guest_email
             ORDER BY b2.created_at DESC LIMIT 1) AS guest_phone,
            COUNT(*) AS total_bookings,
            SUM(b.status = 'confirmed') AS confirmed_count,
            MAX(b.created_at) AS last_booking
     FROM bookings b
     GROUP BY b.guest_email
     ORDER BY last_booking DESC`
  );
  res.json(rows);
});

// Guest profile + booking history
router.get('/guests/detail', authenticateAdmin, async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ message: 'email query parameter required' });

  const [resolved] = await pool.query(
    `SELECT id FROM bookings WHERE guest_email = ? LIMIT 1`,
    [email]
  );
  if (resolved.length === 0) {
    return res.status(404).json({ message: 'Guest not found.' });
  }

  const [bookings] = await pool.query(
    `SELECT b.*, r.name AS room_name
     FROM bookings b
     JOIN rooms r ON b.room_id = r.id
     WHERE b.guest_email = ?
     ORDER BY b.created_at DESC`,
    [email]
  );

  const latest = bookings[0];
  const statusCounts = bookings.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});

  res.json({
    guest_name: latest.guest_name,
    guest_email: latest.guest_email,
    guest_phone: latest.guest_phone,
    total_bookings: bookings.length,
    confirmed_count: statusCounts.confirmed || 0,
    status_counts: statusCounts,
    last_booking: latest.created_at,
    bookings,
  });
});

// Update guest on all their bookings
router.put('/guests', authenticateAdmin, async (req, res) => {
  const { original_email, guest_name, guest_email, guest_phone } = req.body;
  if (!original_email?.trim() || !guest_name?.trim() || !guest_email?.trim() || !guest_phone?.trim()) {
    return res.status(400).json({ message: 'original_email, guest_name, guest_email, and guest_phone are required' });
  }

  const [existing] = await pool.query(
    `SELECT id FROM bookings WHERE guest_email = ? LIMIT 1`,
    [original_email.trim()]
  );
  if (existing.length === 0) {
    return res.status(404).json({ message: 'Guest not found.' });
  }

  if (guest_email.trim().toLowerCase() !== original_email.trim().toLowerCase()) {
    const [dup] = await pool.query('SELECT id FROM bookings WHERE LOWER(guest_email) = LOWER(?) LIMIT 1', [
      guest_email.trim(),
    ]);
    if (dup.length > 0) {
      return res.status(409).json({ message: 'That email is already used by another guest' });
    }
  }

  const [result] = await pool.query(
    'UPDATE bookings SET guest_name = ?, guest_email = ?, guest_phone = ? WHERE guest_email = ?',
    [guest_name.trim(), guest_email.trim(), guest_phone.trim(), original_email.trim()]
  );

  res.json({ message: 'Guest updated', bookings_updated: result.affectedRows });
});

export default router;
