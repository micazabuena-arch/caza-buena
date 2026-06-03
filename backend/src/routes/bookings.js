import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { uploadPaymentProof, uploadSeniorId } from '../middleware/upload.js';
import { uploadFile } from '../utils/fileUpload.js';
import {
  generateReferenceCode,
  calculateNights,
  isRoomAvailable,
  applyDiscount,
  getDayRateSummary,
} from '../utils/booking.js';
import { sendPaymentProofReceivedEmail, sendBookingConfirmation } from '../services/email.js';

const router = Router();

// Public: daily rates & availability for homepage calendar (from/to: YYYY-MM-DD)
router.get('/rate-calendar', async (req, res) => {
  const { from, to, guests } = req.query;
  if (!from || !to) return res.status(400).json({ message: 'from and to dates required' });
  const guestCount = Math.max(1, parseInt(guests, 10) || 1);

  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ message: 'Invalid date range' });
  }

  const maxDays = 62;
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays > maxDays) {
    return res.status(400).json({ message: `Maximum ${maxDays} days per request` });
  }

  const days = {};
  // Use noon UTC to avoid timezone shifting calendar keys (YYYY-MM-DD)
  const cursor = new Date(`${from}T12:00:00`);
  const endDate = new Date(`${to}T12:00:00`);
  while (cursor <= endDate) {
    const key = cursor.toISOString().slice(0, 10);
    days[key] = await getDayRateSummary(pool, key, guestCount);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  res.json({ days });
});

// Public: validate discount code before booking
router.get('/validate-discount', async (req, res) => {
  const { code, nights, subtotal } = req.query;
  if (!code || !nights || !subtotal) {
    return res.status(400).json({ message: 'code, nights, and subtotal required' });
  }
  const result = await applyDiscount(pool, code, parseInt(nights, 10), parseFloat(subtotal));
  if (result.error) return res.status(400).json({ message: result.error });
  res.json({ valid: !!result.code, discount_amount: result.amount, code: result.code });
});

// Public: check availability
router.get('/availability', async (req, res) => {
  const { room_id, check_in, check_out, adults, children_under6, children_7_12 } = req.query;
  if (!room_id || !check_in || !check_out) {
    return res.status(400).json({ message: 'room_id, check_in, check_out required' });
  }
  const available = await isRoomAvailable(pool, room_id, check_in, check_out);
  const nights = calculateNights(check_in, check_out);
  let subtotal = null;
  let breakdown = [];
  let extraPersonCharges = 0;
  let roomSubtotal = null;
  let occupancyError = null;
  let roomLimits = null;
  let extraBreakdown = null;

  if (available && nights > 0) {
    const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ?', [room_id]);
    const room = rooms[0];
    const occupancy =
      adults != null
        ? {
            adults: parseInt(adults, 10) || 0,
            childrenUnder6: parseInt(children_under6, 10) || 0,
            children7_12: parseInt(children_7_12, 10) || 0,
          }
        : null;

    if (occupancy && room) {
      const { validateOccupancy, getRoomLimits } = await import('../config/resortRules.js');
      const check = validateOccupancy(room, occupancy);
      if (!check.valid) occupancyError = check.message;
      roomLimits = getRoomLimits(room);
    }

    const { calculateStayTotal } = await import('../utils/pricing.js');
    const stay = await calculateStayTotal(pool, room_id, check_in, check_out, occupancy);
    subtotal = stay.subtotal;
    roomSubtotal = stay.roomSubtotal;
    extraPersonCharges = stay.extraPersonCharges;
    breakdown = stay.breakdown;
    extraBreakdown = stay.extraBreakdown;
  }
  res.json({
    available: available && !occupancyError,
    nights,
    subtotal,
    room_subtotal: roomSubtotal,
    extra_person_charges: extraPersonCharges,
    extra_breakdown: extraBreakdown || null,
    breakdown,
    occupancy_error: occupancyError,
    room_limits: roomLimits
      ? {
          ...roomLimits,
          capacity_summary: roomLimits.capacitySummary,
        }
      : null,
  });
});

// Public: rooms available for a stay (homepage FIND → rooms list)
router.get('/available-rooms', async (req, res) => {
  const { check_in, check_out, guests } = req.query;
  if (!check_in || !check_out) {
    return res.status(400).json({ message: 'check_in and check_out required' });
  }

  const checkIn = String(check_in).slice(0, 10);
  const checkOut = String(check_out).slice(0, 10);
  const guestCount = Math.max(1, parseInt(guests, 10) || 1);
  const nights = calculateNights(checkIn, checkOut);
  if (nights < 1) return res.status(400).json({ message: 'Invalid date range' });

  const [rooms] = await pool.query(
    `SELECT id, name, room_type, slug, short_description, capacity, min_guests, max_guests,
            included_adults, price_per_night, price_weekend
     FROM rooms WHERE is_active = 1
       AND COALESCE(min_guests, 1) <= ?
       AND COALESCE(max_guests, capacity) >= ?
     ORDER BY sort_order, name`,
    [guestCount, guestCount]
  );

  const { calculateStayTotal } = await import('../utils/pricing.js');
  const available = [];

  for (const room of rooms) {
    const ok = await isRoomAvailable(pool, room.id, checkIn, checkOut);
    if (!ok) continue;

    const stay = await calculateStayTotal(pool, room.id, checkIn, checkOut);
    const [images] = await pool.query(
      'SELECT id, image_url, is_primary FROM room_images WHERE room_id = ? ORDER BY is_primary DESC, sort_order',
      [room.id]
    );

    available.push({
      ...room,
      images,
      nights: stay.nights,
      subtotal: stay.subtotal,
      breakdown: stay.breakdown,
    });
  }

  res.json({
    check_in: checkIn,
    check_out: checkOut,
    guests: guestCount,
    nights,
    rooms: available,
  });
});

// Public: get booking by reference (for payment upload page)
router.get('/reference/:code', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.*, r.name as room_name, r.slug as room_slug,
            pm.name as payment_method_name, pm.type as payment_method_type,
            pm.qr_image_url as payment_qr_image_url,
            pm.account_name as payment_account_name,
            pm.account_number as payment_account_number,
            pm.instructions as payment_instructions
     FROM bookings b
     JOIN rooms r ON b.room_id = r.id
     LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
     WHERE b.reference_code = ?`,
    [req.params.code.toUpperCase()]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });
  res.json(rows[0]);
});

// Public: create booking request
router.post(
  '/',
  [
    body('room_id').toInt().isInt({ min: 1 }),
    body('guest_name').trim().notEmpty(),
    body('guest_email').isEmail(),
    body('guest_phone').trim().notEmpty(),
    body('check_in').matches(/^\d{4}-\d{2}-\d{2}$/),
    body('check_out').matches(/^\d{4}-\d{2}-\d{2}$/),
    body('guest_count').optional().toInt().isInt({ min: 1 }),
    body('adults').optional().toInt().isInt({ min: 1 }),
    body('children_under6').optional().toInt().isInt({ min: 0 }),
    body('children_7_12').optional().toInt().isInt({ min: 0 }),
    body('valid_id').optional().trim(),
    body('estimated_arrival').optional().trim(),
    body('payment_option').optional().isIn(['deposit', 'full', 'custom']),
    body('custom_payment_amount').optional().isFloat({ min: 0 }),
    body('island_hopping').optional({ values: 'falsy' }).isBoolean().toBoolean(),
    body('island_hopping_data').optional().isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
    const {
      room_id,
      guest_name,
      guest_email,
      guest_phone,
      guest_count: guestCountBody,
      adults: adultsBody,
      children_under6 = 0,
      children_7_12 = 0,
      valid_id,
      estimated_arrival,
      check_in,
      check_out,
      special_requests,
      discount_code,
      payment_method_id,
      payment_option = 'deposit',
      custom_payment_amount,
      island_hopping: islandHoppingFlag,
      island_hopping_data: islandHoppingData,
    } = req.body;

    const adults = adultsBody != null ? parseInt(adultsBody, 10) : parseInt(guestCountBody, 10) || 1;
    const childrenUnder6 = parseInt(children_under6, 10) || 0;
    const children712 = parseInt(children_7_12, 10) || 0;
    const guest_count =
      guestCountBody != null
        ? parseInt(guestCountBody, 10)
        : adults + childrenUnder6 + children712;

    const checkIn = String(check_in).slice(0, 10);
    const checkOut = String(check_out).slice(0, 10);

    const nights = calculateNights(checkIn, checkOut);
    if (nights < 1) return res.status(400).json({ message: 'Invalid date range' });

    const available = await isRoomAvailable(pool, room_id, checkIn, checkOut);
    if (!available) return res.status(409).json({ message: 'Room not available for selected dates' });

    const [rooms] = await pool.query('SELECT * FROM rooms WHERE id = ? AND is_active = 1', [room_id]);
    if (rooms.length === 0) return res.status(404).json({ message: 'Room not found' });

    const room = rooms[0];
    const occupancy = { adults, childrenUnder6, children7_12: children712 };

    const { validateOccupancy } = await import('../config/resortRules.js');
    const occCheck = validateOccupancy(room, occupancy);
    if (!occCheck.valid) return res.status(400).json({ message: occCheck.message });

    const { calculateStayTotal } = await import('../utils/pricing.js');
    const stay = await calculateStayTotal(pool, room_id, checkIn, checkOut, {
      adults,
      childrenUnder6,
      children7_12: children712,
    });
    const { subtotal, breakdown, extraPersonCharges, roomSubtotal } = stay;
    const avgNightlyRate = nights > 0 ? subtotal / nights : Number(room.price_per_night);
    const { amount: discountAmount, code: appliedCode, error: discountError } =
      await applyDiscount(pool, discount_code, nights, subtotal);

    if (discount_code && discountError) {
      return res.status(400).json({ message: discountError });
    }

    let islandHopping = Boolean(islandHoppingFlag);
    let islandHoppingAmount = 0;
    let islandHoppingStored = null;

    if (islandHopping) {
      const { validateIslandHoppingPayload, calculateIslandHopping } = await import(
        '../utils/islandHopping.js'
      );
      const validation = validateIslandHoppingPayload(islandHoppingData);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
      try {
        const computed = calculateIslandHopping(islandHoppingData.passengers);
        if (computed.error) return res.status(400).json({ message: computed.error });
        islandHoppingAmount = computed.total;
        islandHoppingStored = {
          passengers: islandHoppingData.passengers,
          passenger_address: islandHoppingData.passenger_address.trim(),
          payor_name: islandHoppingData.payor_name.trim(),
          payor_address: islandHoppingData.payor_address.trim(),
          payor_phone: islandHoppingData.payor_phone.trim(),
          emergency_contact_name: islandHoppingData.emergency_contact_name.trim(),
          emergency_contact_phone: islandHoppingData.emergency_contact_phone.trim(),
          breakdown: computed.breakdown,
          boat_tier: computed.boat_tier,
          boat_label: computed.boat_label,
          total: computed.total,
        };
      } catch (e) {
        return res.status(400).json({ message: e.message || 'Invalid island hopping details' });
      }
    }

    const roomTotal = Math.max(0, subtotal - discountAmount);
    const total = roomTotal + islandHoppingAmount;

    const [settingRows] = await pool.query(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'booking_deposit_percent'"
    );
    const { resolveAmountToPay, getDepositPercent } = await import('../utils/paymentAmount.js');
    const depositPercent = getDepositPercent(settingRows[0]?.setting_value);
    const payResolved = resolveAmountToPay(
      total,
      payment_option,
      custom_payment_amount,
      depositPercent
    );
    if (payResolved.error) {
      return res.status(400).json({ message: payResolved.error });
    }
    const amountToPay = payResolved.amount;

    const reference = generateReferenceCode();

    const [result] = await pool.query(
      `INSERT INTO bookings (
        reference_code, room_id, guest_name, guest_email, guest_phone,
        valid_id, estimated_arrival, guest_count, adults, children_under6, children_7_12,
        special_requests, check_in, check_out, nights,
        room_rate, discount_amount, discount_code, total_amount, extra_person_charges,
        island_hopping, island_hopping_amount, island_hopping_data,
        status, payment_method_id, payment_option, amount_to_pay
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', ?, ?, ?)`,
      [
        reference,
        room_id,
        guest_name,
        guest_email,
        guest_phone,
        valid_id || null,
        estimated_arrival || null,
        guest_count,
        adults,
        childrenUnder6,
        children712,
        special_requests || null,
        checkIn,
        checkOut,
        nights,
        avgNightlyRate,
        discountAmount,
        appliedCode,
        total,
        extraPersonCharges || 0,
        islandHopping ? 1 : 0,
        islandHoppingAmount,
        islandHoppingStored ? JSON.stringify(islandHoppingStored) : null,
        payment_method_id || null,
        payment_option,
        amountToPay,
      ]
    );

    const booking = {
      id: result.insertId,
      reference_code: reference,
      guest_name,
      guest_email,
      check_in: checkIn,
      check_out: checkOut,
      total_amount: total,
      amount_to_pay: amountToPay,
      payment_option,
      deposit_percent: depositPercent,
      island_hopping: islandHopping,
      island_hopping_amount: islandHoppingAmount,
      status: 'awaiting_payment',
    };

    res.status(201).json({
      message: 'Booking request submitted',
      payment_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking/confirm/${reference}`,
      booking: { ...booking, room_name: room.name, price_breakdown: breakdown },
    });
    } catch (err) {
      console.error('Create booking error:', err);
      res.status(500).json({ message: 'Unable to submit booking. Please try again.' });
    }
  }
);

// Admin routes (registered before dynamic :reference routes)
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  const { status, from, to, open_only } = req.query;
  let query = `
    SELECT b.*, r.name as room_name
    FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE 1=1
  `;
  const params = [];
  // Open bookings: still in workflow (not yet confirmed or rejected)
  if (open_only === '1' || open_only === 'true') {
    query += " AND b.status NOT IN ('confirmed', 'rejected')";
  } else if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }
  if (from) {
    query += ' AND b.check_in >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND b.check_out <= ?';
    params.push(to);
  }
  query += ' ORDER BY b.created_at DESC';
  const [bookings] = await pool.query(query, params);
  res.json(bookings);
});

router.get('/admin/calendar', authenticateAdmin, async (req, res) => {
  const { month, year } = req.query;
  const y = year || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;

  const [bookings] = await pool.query(
    `SELECT b.id, b.reference_code, b.guest_name, b.check_in, b.check_out,
            b.status, b.total_amount, r.name as room_name, r.id as room_id
     FROM bookings b JOIN rooms r ON b.room_id = r.id
     WHERE b.status NOT IN ('cancelled', 'rejected')
       AND (
         (YEAR(b.check_in) = ? AND MONTH(b.check_in) = ?)
         OR (YEAR(b.check_out) = ? AND MONTH(b.check_out) = ?)
       )`,
    [y, m, y, m]
  );
  res.json(bookings);
});

router.patch('/admin/:id/status', authenticateAdmin, async (req, res) => {
  const { status, admin_notes, rejection_reason } = req.body;
  const allowed = ['pending', 'awaiting_payment', 'payment_submitted', 'confirmed', 'rejected', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  const [rows] = await pool.query(
    `SELECT b.*, r.name as room_name FROM bookings b
     JOIN rooms r ON b.room_id = r.id WHERE b.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

  const confirmedAt = status === 'confirmed' ? new Date() : null;
  await pool.query(
    `UPDATE bookings SET status = ?, admin_notes = ?, rejection_reason = ?,
     confirmed_at = COALESCE(?, confirmed_at) WHERE id = ?`,
    [status, admin_notes || null, rejection_reason || null, confirmedAt, req.params.id]
  );

  let emailResult = { sent: false };
  if (status === 'confirmed') {
    emailResult = await sendBookingConfirmation(rows[0], { name: rows[0].room_name });
    if (rows[0].discount_code) {
      await pool.query(
        'UPDATE discounts SET used_count = used_count + 1 WHERE code = ?',
        [rows[0].discount_code]
      );
    }
  }

  res.json({
    message: 'Booking updated',
    email_sent: emailResult.sent,
    email_hint: emailResult.hint || null,
  });
});

// Admin: single booking detail
router.get('/admin/:id', authenticateAdmin, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.*, r.name as room_name, pm.name as payment_method_name, pm.type as payment_method_type
     FROM bookings b
     JOIN rooms r ON b.room_id = r.id
     LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
     WHERE b.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });
  res.json(rows[0]);
});

// Public: upload payment proof
router.post(
  '/:reference/payment-proof',
  uploadPaymentProof.single('proof'),
  async (req, res) => {
    const code = req.params.reference.toUpperCase();
    const [rows] = await pool.query(
      `SELECT b.*, r.name as room_name FROM bookings b
       JOIN rooms r ON b.room_id = r.id WHERE b.reference_code = ?`,
      [code]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

    const booking = rows[0];
    if (!['awaiting_payment', 'payment_submitted'].includes(booking.status)) {
      return res.status(400).json({ message: 'Payment cannot be uploaded for this booking status' });
    }

    if (!req.file) return res.status(400).json({ message: 'Payment proof file required' });

    const isPdf = req.file.mimetype === 'application/pdf';
    const { url: proofUrl, publicId } = await uploadFile(req.file.buffer, 'payment-proofs', {
      originalName: req.file.originalname,
      resourceType: isPdf ? 'raw' : 'image',
    });

    const { payment_method_id } = req.body;
    const sendAcknowledgmentEmail = booking.status === 'awaiting_payment';

    await pool.query(
      `UPDATE bookings SET
        payment_proof_url = ?, payment_proof_public_id = ?,
        status = 'payment_submitted',
        payment_method_id = COALESCE(?, payment_method_id)
       WHERE id = ?`,
      [proofUrl, publicId, payment_method_id || null, booking.id]
    );

    let emailResult = { sent: false };
    if (sendAcknowledgmentEmail) {
      emailResult = await sendPaymentProofReceivedEmail(
        { ...booking, status: 'payment_submitted' },
        { name: booking.room_name }
      );
    }

    res.json({
      message: 'Payment proof uploaded. Our team will verify shortly.',
      email_sent: emailResult.sent,
      email_hint: emailResult.hint || null,
    });
  }
);

// Public: upload senior citizen ID for island hopping passenger
router.post(
  '/:reference/senior-id',
  uploadSeniorId.single('id'),
  async (req, res) => {
    const code = req.params.reference.toUpperCase();
    const passengerIndex = parseInt(req.body.passenger_index, 10);

    if (!Number.isFinite(passengerIndex) || passengerIndex < 0) {
      return res.status(400).json({ message: 'Valid passenger_index is required' });
    }
    if (!req.file) return res.status(400).json({ message: 'Senior citizen ID file required' });

    const [rows] = await pool.query('SELECT * FROM bookings WHERE reference_code = ?', [code]);
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

    const booking = rows[0];
    if (!booking.island_hopping) {
      return res.status(400).json({ message: 'This booking does not include island hopping' });
    }

    const { parseIslandHoppingData, isSeniorPassenger } = await import('../utils/islandHopping.js');
    const islandData = parseIslandHoppingData(booking.island_hopping_data);
    if (!islandData?.passengers?.length) {
      return res.status(400).json({ message: 'Island hopping passenger list not found' });
    }
    if (passengerIndex >= islandData.passengers.length) {
      return res.status(400).json({ message: 'Invalid passenger index' });
    }

    const passenger = islandData.passengers[passengerIndex];
    if (!isSeniorPassenger(passenger)) {
      return res.status(400).json({ message: 'Senior citizen ID is only required for guests aged 60+' });
    }

    const isPdf = req.file.mimetype === 'application/pdf';
    const { url: idUrl, publicId } = await uploadFile(req.file.buffer, 'senior-ids', {
      originalName: req.file.originalname,
      resourceType: isPdf ? 'raw' : 'image',
    });

    islandData.passengers[passengerIndex] = {
      ...passenger,
      senior_id_url: idUrl,
      senior_id_public_id: publicId,
    };

    await pool.query('UPDATE bookings SET island_hopping_data = ? WHERE id = ?', [
      JSON.stringify(islandData),
      booking.id,
    ]);

    res.json({
      message: 'Senior citizen ID uploaded.',
      passenger_index: passengerIndex,
      senior_id_url: idUrl,
    });
  }
);

export default router;
