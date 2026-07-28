import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { uploadPaymentProof, uploadSeniorId, uploadPwdId } from '../middleware/upload.js';
import { uploadFile } from '../utils/fileUpload.js';
import {
  generateReferenceCode,
  calculateNights,
  isRoomAvailable,
  isAnteDateCheckIn,
  applyDiscount,
  getRateCalendarDays,
} from '../utils/booking.js';
import { sendPaymentProofReceivedEmail, sendBookingConfirmation, sendBookingRejectedEmail } from '../services/email.js';
import { prepareBookingForEmail } from '../utils/bookingRooms.js';

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

  const days = await getRateCalendarDays(pool, from, to, guestCount);
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
  const {
    room_id,
    check_in,
    check_out,
    adults,
    children_under6,
    children_7_12,
    exclude_booking_id,
  } = req.query;
  if (!room_id || !check_in || !check_out) {
    return res.status(400).json({ message: 'room_id, check_in, check_out required' });
  }
  const excludeId = exclude_booking_id ? parseInt(exclude_booking_id, 10) : null;
  const available = await isRoomAvailable(
    pool,
    room_id,
    check_in,
    check_out,
    Number.isFinite(excludeId) ? excludeId : null
  );
  const nights = calculateNights(check_in, check_out);
  let subtotal = null;
  let breakdown = [];
  let extraPersonCharges = 0;
  let roomSubtotal = null;
  let occupancyError = null;
  let roomLimits = null;
  let extraBreakdown = null;

  // Always price the stay when nights are valid — even if the room is booked —
  // so admin ante-date / recording can still show totals and create an SOA.
  if (nights > 0) {
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
          pricing_summary: roomLimits.pricingSummary,
          included_adults: roomLimits.includedAdults,
          min_guests: roomLimits.adminMin,
          max_guests: roomLimits.adminMax ?? roomLimits.maxGuests,
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
  const { attachBookingRooms } = await import('../utils/bookingRooms.js');
  const booking = await attachBookingRooms(pool, rows[0]);
  res.json(booking);
});

// Public: create booking request
router.post(
  '/',
  [
    body('room_id').optional({ nullable: true }).toInt().isInt({ min: 1 }),
    body('room_lines').optional().isArray({ min: 1 }),
    body('room_lines.*.room_id').optional().toInt().isInt({ min: 1 }),
    body('room_lines.*.adults').optional().toInt().isInt({ min: 1 }),
    body('room_lines.*.children_under6').optional().toInt().isInt({ min: 0 }),
    body('room_lines.*.children_7_12').optional().toInt().isInt({ min: 0 }),
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
    body('bringing_car').optional({ values: 'falsy' }).isBoolean().toBoolean(),
    body('car_count').optional().toInt().isInt({ min: 0, max: 5 }),
    body('pet_count').optional().toInt().isInt({ min: 0, max: 2 }),
    body('bilao_enabled').optional({ values: 'falsy' }).isBoolean().toBoolean(),
    body('bilao_package').optional().trim(),
    body('bilao_lines').optional().isArray(),
    body('boodle_fight_enabled').optional({ values: 'falsy' }).isBoolean().toBoolean(),
    body('boodle_fight_tier').optional().trim(),
    body('boodle_lines').optional().isArray(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const hasRoomLines = Array.isArray(req.body.room_lines) && req.body.room_lines.length > 0;
    if (!hasRoomLines && !req.body.room_id) {
      return res.status(400).json({ message: 'Select at least one room' });
    }

    // Public bookings cannot be back-dated — only admins may record past (ante-dated) stays.
    if (isAnteDateCheckIn(req.body.check_in)) {
      return res.status(400).json({ message: 'Check-in date cannot be in the past.' });
    }

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
      bringing_car: bringingCarFlag,
      car_count: carCountBody,
      pet_count: petCountBody,
      bilao_enabled: bilaoEnabledFlag,
      bilao_package: bilaoPackageBody,
      bilao_lines: bilaoLinesBody,
      boodle_fight_enabled: boodleFightEnabledFlag,
      boodle_fight_tier: boodleFightTierBody,
      boodle_lines: boodleLinesBody,
      room_lines: roomLinesBody,
    } = req.body;

    const checkIn = String(check_in).slice(0, 10);
    const checkOut = String(check_out).slice(0, 10);

    const {
      normalizeRoomLines,
      validateAndPriceRoomLines,
      insertBookingRooms,
      attachBookingRooms,
    } = await import('../utils/bookingRooms.js');

    const rawLines = normalizeRoomLines({
      room_id,
      room_lines: roomLinesBody,
      adults: adultsBody,
      children_under6,
      children_7_12,
      guest_count: guestCountBody,
    });

    const priced = await validateAndPriceRoomLines(pool, checkIn, checkOut, rawLines);
    if (priced.error) return res.status(400).json({ message: priced.error });

    const {
      nights,
      lines: pricedLines,
      combinedSubtotal: subtotal,
      combinedExtraCharges: extraPersonCharges,
      totalAdults: adults,
      totalUnder6: childrenUnder6,
      total712: children712,
      totalGuests: guest_count,
      primaryRoom: room,
    } = priced;

    const avgNightlyRate = nights > 0 ? subtotal / nights : Number(room.price_per_night);
    const breakdown = pricedLines.flatMap((line) =>
      (line.breakdown || []).map((night) => ({ ...night, room_name: line.room.name }))
    );

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

    const { validateBookingExtras, serializeFoodLines } = await import('../utils/bookingExtras.js');
    const extrasValidation = validateBookingExtras(
      {
        bringing_car: bringingCarFlag,
        car_count: carCountBody,
        pet_count: petCountBody,
        bilao_enabled: bilaoEnabledFlag,
        bilao_package: bilaoPackageBody,
        bilao_lines: bilaoLinesBody,
        boodle_fight_enabled: boodleFightEnabledFlag,
        boodle_fight_tier: boodleFightTierBody,
        boodle_lines: boodleLinesBody,
      },
      priced.hasSuite ? 'suite' : room.room_type
    );
    if (!extrasValidation.valid) {
      return res.status(400).json({ message: extrasValidation.message });
    }

    const roomTotal = Math.max(0, subtotal - discountAmount);
    const total =
      roomTotal +
      islandHoppingAmount +
      extrasValidation.bilao_amount +
      extrasValidation.boodle_fight_amount;

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
        bringing_car, car_count, pet_count, pet_deposit_amount,
        bilao_package, bilao_amount, bilao_lines, boodle_fight, boodle_fight_tier, boodle_fight_amount, boodle_lines,
        status, payment_method_id, payment_option, amount_to_pay
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', ?, ?, ?)`,
      [
        reference,
        pricedLines[0].room_id,
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
        extrasValidation.bringing_car ? 1 : 0,
        extrasValidation.car_count,
        extrasValidation.pet_count,
        extrasValidation.pet_deposit_amount,
        extrasValidation.bilao_package,
        extrasValidation.bilao_amount,
        serializeFoodLines(extrasValidation.bilao_lines),
        extrasValidation.boodle_fight ? 1 : 0,
        extrasValidation.boodle_fight_tier,
        extrasValidation.boodle_fight_amount,
        serializeFoodLines(extrasValidation.boodle_lines),
        payment_method_id || null,
        payment_option,
        amountToPay,
      ]
    );

    await insertBookingRooms(pool, result.insertId, pricedLines);

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
      room_id: pricedLines[0].room_id,
    };

    const bookingWithRooms = await attachBookingRooms(pool, {
      ...booking,
      room_name: pricedLines.map((l) => l.room.name).join(', '),
    });

    res.status(201).json({
      message: 'Booking request submitted',
      payment_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/booking/confirm/${reference}`,
      booking: { ...bookingWithRooms, price_breakdown: breakdown },
    });
    } catch (err) {
      console.error('Create booking error:', err);
      res.status(500).json({ message: 'Unable to submit booking. Please try again.' });
    }
  }
);

// Admin: create manual booking (walk-in, phone, etc.) — blocks site availability when confirmed
router.post(
  '/admin',
  authenticateAdmin,
  [
    body('room_id').optional({ nullable: true }).toInt().isInt({ min: 1 }),
    body('room_lines').optional().isArray({ min: 1 }),
    body('room_lines.*.room_id').optional().toInt().isInt({ min: 1 }),
    body('room_lines.*.adults').optional().toInt().isInt({ min: 1 }),
    body('room_lines.*.children_under6').optional().toInt().isInt({ min: 0 }),
    body('room_lines.*.children_7_12').optional().toInt().isInt({ min: 0 }),
    body('guest_name').trim().notEmpty(),
    body('guest_email').isEmail(),
    body('guest_phone').trim().notEmpty(),
    body('check_in').matches(/^\d{4}-\d{2}-\d{2}$/),
    body('check_out').matches(/^\d{4}-\d{2}-\d{2}$/),
    body('adults').optional().toInt().isInt({ min: 1 }),
    body('children_under6').optional().toInt().isInt({ min: 0 }),
    body('children_7_12').optional().toInt().isInt({ min: 0 }),
    body('valid_id').optional().trim(),
    body('estimated_arrival').optional().trim(),
    body('status')
      .optional()
      .isIn(['pending', 'awaiting_payment', 'payment_submitted', 'confirmed']),
    body('special_requests').optional().trim(),
    body('send_confirmation_email').optional().isBoolean(),
    body('payment_method_id').optional({ nullable: true }).toInt().isInt({ min: 1 }),
    body('manual_payment_method').optional().trim(),
    body('payment_option').optional().isIn(['deposit', 'full', 'custom']),
    body('custom_payment_amount').optional().isFloat({ min: 0 }),
    body('island_hopping').optional({ values: 'falsy' }).isBoolean().toBoolean(),
    body('island_hopping_data').optional().isObject(),
    body('bringing_car').optional({ values: 'falsy' }).isBoolean().toBoolean(),
    body('car_count').optional().toInt().isInt({ min: 0, max: 5 }),
    body('pet_count').optional().toInt().isInt({ min: 0, max: 2 }),
    body('bilao_enabled').optional({ values: 'falsy' }).isBoolean().toBoolean(),
    body('bilao_package').optional().trim(),
    body('bilao_lines').optional().isArray(),
    body('boodle_fight_enabled').optional({ values: 'falsy' }).isBoolean().toBoolean(),
    body('boodle_fight_tier').optional().trim(),
    body('boodle_lines').optional().isArray(),
    body('admin_discount_amount').optional().isFloat({ min: 0 }),
    body('admin_discount_note').optional().trim().isLength({ max: 255 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const hasRoomLines = Array.isArray(req.body.room_lines) && req.body.room_lines.length > 0;
    if (!hasRoomLines && !req.body.room_id) {
      return res.status(400).json({ message: 'Select at least one room' });
    }

    try {
      const { createManualBooking } = await import('../utils/manualBookingCreate.js');
      const result = await createManualBooking(req.body);
      if (result.error) {
        const status = result.error.includes('not available') ? 409 : 400;
        return res.status(status).json({ message: result.error });
      }

      res.status(201).json({
        message: 'Manual booking created',
        booking: result.booking,
        email_sent: result.emailResult.sent,
        email_hint: result.emailResult.hint || null,
      });
    } catch (err) {
      console.error('Admin create booking error:', err);
      res.status(500).json({ message: 'Unable to create booking. Please try again.' });
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
  const { attachBookingRoomsToList } = await import('../utils/bookingRooms.js');
  res.json(await attachBookingRoomsToList(pool, bookings));
});

router.get('/admin/calendar', authenticateAdmin, async (req, res) => {
  const { month, year } = req.query;
  const y = year || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;

  const [bookings] = await pool.query(
    `SELECT b.id, b.reference_code, b.guest_name, b.check_in, b.check_out,
            b.status, b.total_amount, b.guest_count, b.adults, b.children_under6, b.children_7_12,
            r.name as room_name, r.id as room_id
     FROM bookings b JOIN rooms r ON b.room_id = r.id
     WHERE b.status NOT IN ('cancelled', 'rejected')
       AND b.check_out >= CURDATE()
       AND (
         (YEAR(b.check_in) = ? AND MONTH(b.check_in) = ?)
         OR (YEAR(b.check_out) = ? AND MONTH(b.check_out) = ?)
       )`,
    [y, m, y, m]
  );
  res.json(bookings);
});

router.patch('/admin/:id', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, r.name AS room_name, r.room_type FROM bookings b
       JOIN rooms r ON b.room_id = r.id WHERE b.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

    const { computeAdminBookingUpdate } = await import('../utils/adminBookingUpdate.js');
    const result = await computeAdminBookingUpdate(pool, rows[0], req.body);
    if (result.error) return res.status(400).json({ message: result.error });

    const v = result.values;
    await pool.query(
      `UPDATE bookings SET
        room_id = ?, guest_name = ?, guest_email = ?, guest_phone = ?,
        valid_id = ?, estimated_arrival = ?, guest_count = ?, adults = ?,
        children_under6 = ?, children_7_12 = ?, special_requests = ?, admin_notes = ?,
        check_in = ?, check_out = ?, nights = ?, room_rate = ?, discount_amount = ?,
        discount_code = ?, discount_note = ?, total_amount = ?, extra_person_charges = ?,
        island_hopping = ?, island_hopping_amount = ?, island_hopping_data = ?,
        bringing_car = ?, car_count = ?, pet_count = ?, pet_deposit_amount = ?,
        bilao_package = ?, bilao_amount = ?, bilao_lines = ?, boodle_fight = ?, boodle_fight_tier = ?,
        boodle_fight_amount = ?, boodle_lines = ?, payment_method_id = ?, payment_option = ?, amount_to_pay = ?
       WHERE id = ?`,
      [
        v.room_id,
        v.guest_name,
        v.guest_email,
        v.guest_phone,
        v.valid_id,
        v.estimated_arrival,
        v.guest_count,
        v.adults,
        v.children_under6,
        v.children_7_12,
        v.special_requests,
        v.admin_notes,
        v.check_in,
        v.check_out,
        v.nights,
        v.room_rate,
        v.discount_amount,
        v.discount_code,
        v.discount_note,
        v.total_amount,
        v.extra_person_charges,
        v.island_hopping,
        v.island_hopping_amount,
        v.island_hopping_data,
        v.bringing_car,
        v.car_count,
        v.pet_count,
        v.pet_deposit_amount,
        v.bilao_package,
        v.bilao_amount,
        v.bilao_lines,
        v.boodle_fight,
        v.boodle_fight_tier,
        v.boodle_fight_amount,
        v.boodle_lines,
        v.payment_method_id,
        v.payment_option,
        v.amount_to_pay,
        req.params.id,
      ]
    );

    if (Array.isArray(result.pricedLines) && result.pricedLines.length > 0) {
      const { insertBookingRooms } = await import('../utils/bookingRooms.js');
      await pool.query('DELETE FROM booking_rooms WHERE booking_id = ?', [req.params.id]);
      await insertBookingRooms(pool, req.params.id, result.pricedLines);
    }

    const [updated] = await pool.query(
      `SELECT b.*, r.name AS room_name, pm.name AS payment_method_name, pm.type AS payment_method_type
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
       WHERE b.id = ?`,
      [req.params.id]
    );

    const { attachBookingRooms } = await import('../utils/bookingRooms.js');
    const booking = await attachBookingRooms(pool, updated[0]);

    res.json({ message: 'Booking updated', booking });
  } catch (err) {
    console.error('Admin update booking error:', err);
    res.status(500).json({ message: 'Unable to update booking' });
  }
});

router.get('/admin/:id/rebook-quote', authenticateAdmin, async (req, res) => {
  const { check_in, check_out, room_id } = req.query;
  if (!check_in || !check_out) {
    return res.status(400).json({ message: 'check_in and check_out are required' });
  }

  const [rows] = await pool.query(
    `SELECT b.*, r.name AS room_name FROM bookings b
     JOIN rooms r ON b.room_id = r.id WHERE b.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

  const booking = rows[0];
  const { computeRebookPricing } = await import('../utils/rebookPricing.js');
  const quote = await computeRebookPricing(pool, booking, {
    checkIn: check_in,
    checkOut: check_out,
    roomId: room_id || booking.room_id,
  });
  if (quote.error) return res.status(400).json({ message: quote.error });

  res.json(quote);
});

router.patch('/admin/:id/dates', authenticateAdmin, async (req, res) => {
  const { check_in, check_out } = req.body;
  if (!check_in || !check_out || !/^\d{4}-\d{2}-\d{2}$/.test(check_in) || !/^\d{4}-\d{2}-\d{2}$/.test(check_out)) {
    return res.status(400).json({ message: 'check_in and check_out are required (YYYY-MM-DD)' });
  }

  const checkIn = String(check_in).slice(0, 10);
  const checkOut = String(check_out).slice(0, 10);
  const nights = calculateNights(checkIn, checkOut);
  if (nights < 1) {
    return res.status(400).json({ message: 'Check-out must be after check-in' });
  }

  const [rows] = await pool.query(
    `SELECT b.*, r.name AS room_name FROM bookings b
     JOIN rooms r ON b.room_id = r.id WHERE b.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

  const booking = rows[0];
  const blocksAvailability = ['pending', 'awaiting_payment', 'payment_submitted', 'confirmed'].includes(
    booking.status
  );
  // Ante-dated stays (past check-in) skip conflict checks for recording / SOA.
  if (blocksAvailability && !isAnteDateCheckIn(checkIn)) {
    const available = await isRoomAvailable(pool, booking.room_id, checkIn, checkOut, booking.id);
    if (!available) {
      return res.status(409).json({ message: 'Room is not available for the selected dates' });
    }
  }

  const occupancy = {
    adults: booking.adults ?? booking.guest_count ?? 1,
    childrenUnder6: booking.children_under6 || 0,
    children7_12: booking.children_7_12 || 0,
  };

  const { calculateStayTotal } = await import('../utils/pricing.js');
  const stay = await calculateStayTotal(pool, booking.room_id, checkIn, checkOut, occupancy);
  const { amount: discountAmount } = await applyDiscount(
    pool,
    booking.discount_code,
    nights,
    stay.subtotal
  );
  const roomTotal = Math.max(0, stay.subtotal - (discountAmount || 0));
  const islandAmount = booking.island_hopping ? Number(booking.island_hopping_amount) || 0 : 0;
  const bilaoAmount = Number(booking.bilao_amount) || 0;
  const boodleAmount = Number(booking.boodle_fight_amount) || 0;
  const { stayAddonsTotal } = await import('../utils/stayAddons.js');
  const duringStayAmount = stayAddonsTotal(booking.stay_addons);
  // Custom during-stay charges (booking_addons) must stay in the total when only the
  // dates change — otherwise a quick date edit would silently drop them.
  let customAddonsAmount = 0;
  try {
    const [addonRows] = await pool.query(
      'SELECT amount FROM booking_addons WHERE booking_id = ?',
      [booking.id]
    );
    customAddonsAmount = (addonRows || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  } catch (err) {
    console.warn('[Booking dates] booking_addons unavailable:', err.message);
  }
  const total =
    roomTotal + islandAmount + bilaoAmount + boodleAmount + duringStayAmount + customAddonsAmount;
  const avgNightlyRate = nights > 0 ? stay.subtotal / nights : Number(booking.room_rate);

  const [settingRows] = await pool.query(
    "SELECT setting_value FROM site_settings WHERE setting_key = 'booking_deposit_percent'"
  );
  const { resolveAmountToPay, getDepositPercent } = await import('../utils/paymentAmount.js');
  const depositPercent = getDepositPercent(settingRows[0]?.setting_value);
  const customAmount =
    booking.payment_option === 'custom' ? booking.amount_to_pay : undefined;
  const payResolved = resolveAmountToPay(total, booking.payment_option, customAmount, depositPercent);
  if (payResolved.error) {
    return res.status(400).json({ message: payResolved.error });
  }

  await pool.query(
    `UPDATE bookings SET
       check_in = ?, check_out = ?, nights = ?,
       room_rate = ?, discount_amount = ?, total_amount = ?,
       extra_person_charges = ?, amount_to_pay = ?
     WHERE id = ?`,
    [
      checkIn,
      checkOut,
      nights,
      avgNightlyRate,
      discountAmount || 0,
      total,
      stay.extraPersonCharges || 0,
      payResolved.amount,
      booking.id,
    ]
  );

  const [updated] = await pool.query(
    `SELECT b.*, r.name AS room_name FROM bookings b
     JOIN rooms r ON b.room_id = r.id WHERE b.id = ?`,
    [booking.id]
  );

  const { computeRebookPricing } = await import('../utils/rebookPricing.js');
  const pricingAdjustment = await computeRebookPricing(pool, booking, {
    checkIn,
    checkOut,
  });

  res.json({
    message: 'Stay dates updated',
    booking: updated[0],
    price_breakdown: stay.breakdown,
    pricing_adjustment: pricingAdjustment.error ? null : pricingAdjustment,
  });
});

router.patch('/admin/:id/stay-addons', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, r.name AS room_name FROM bookings b
       JOIN rooms r ON b.room_id = r.id WHERE b.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

    const booking = rows[0];
    const { normalizeStayAddonsInput, stayAddonsTotal } = await import('../utils/stayAddons.js');
    const parsed = normalizeStayAddonsInput(req.body?.stay_addons);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const oldAddonsTotal = stayAddonsTotal(booking.stay_addons);
    const newAddonsTotal = parsed.total;
    const baseTotal = Number(booking.total_amount) - oldAddonsTotal;
    const total = Math.round((baseTotal + newAddonsTotal) * 100) / 100;

    const [settingRows] = await pool.query(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'booking_deposit_percent'"
    );
    const { resolveAmountToPay, getDepositPercent } = await import('../utils/paymentAmount.js');
    const depositPercent = getDepositPercent(settingRows[0]?.setting_value);
    const customAmount =
      booking.payment_option === 'custom' ? booking.amount_to_pay : undefined;
    const payResolved = resolveAmountToPay(total, booking.payment_option, customAmount, depositPercent);
    if (payResolved.error) return res.status(400).json({ message: payResolved.error });

    await pool.query(
      `UPDATE bookings SET stay_addons = ?, total_amount = ?, amount_to_pay = ? WHERE id = ?`,
      [JSON.stringify(parsed.addons), total, payResolved.amount, booking.id]
    );

    const [updated] = await pool.query(
      `SELECT b.*, r.name AS room_name, pm.name AS payment_method_name, pm.type AS payment_method_type
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
       WHERE b.id = ?`,
      [booking.id]
    );

    const { attachBookingRooms } = await import('../utils/bookingRooms.js');
    const updatedBooking = await attachBookingRooms(pool, updated[0]);
    res.json({ message: 'During-stay add-ons updated', booking: updatedBooking });
  } catch (err) {
    console.error('Admin stay add-ons error:', err);
    res.status(500).json({ message: 'Unable to update during-stay add-ons' });
  }
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

  const booking = rows[0];
  const hadPaymentProof =
    Boolean(booking.payment_proof_url) || booking.status === 'payment_submitted';
  const shouldEmailRejection = status === 'rejected' && hadPaymentProof;

  const confirmedAt = status === 'confirmed' ? new Date() : null;
  await pool.query(
    `UPDATE bookings SET status = ?, admin_notes = ?, rejection_reason = ?,
     confirmed_at = COALESCE(?, confirmed_at) WHERE id = ?`,
    [status, admin_notes || null, rejection_reason || null, confirmedAt, req.params.id]
  );

  if (status === 'confirmed' && rows[0].discount_code) {
    await pool.query(
      'UPDATE discounts SET used_count = used_count + 1 WHERE code = ?',
      [rows[0].discount_code]
    );
  }

  res.json({
    message: 'Booking updated',
    email_sent: false,
    email_pending: status === 'confirmed' || shouldEmailRejection,
  });

  if (status === 'confirmed') {
    prepareBookingForEmail(pool, { ...booking, status: 'confirmed' })
      .then((emailBooking) =>
        sendBookingConfirmation(emailBooking, { name: emailBooking.room_name })
      )
      .then((emailResult) => {
        if (!emailResult.sent) {
          console.warn('[Booking confirm] Guest email not sent:', emailResult.reason, emailResult.hint || '');
        }
      })
      .catch((err) => console.error('[Booking confirm] Guest email error:', err.message));
  }

  if (shouldEmailRejection) {
    prepareBookingForEmail(pool, {
      ...booking,
      status: 'rejected',
      rejection_reason: rejection_reason || null,
    })
      .then((emailBooking) =>
        sendBookingRejectedEmail(
          emailBooking,
          { name: emailBooking.room_name },
          rejection_reason
        )
      )
      .then((emailResult) => {
        if (!emailResult.sent) {
          console.warn('[Booking reject] Guest email not sent:', emailResult.reason, emailResult.hint || '');
        }
      })
      .catch((err) => console.error('[Booking reject] Guest email error:', err.message));
  }
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
  const { attachBookingRooms } = await import('../utils/bookingRooms.js');
  const booking = await attachBookingRooms(pool, rows[0]);

  // Attach custom add-ons (table may be missing before migrate — don't block booking view)
  try {
    const [addons] = await pool.query(
      'SELECT * FROM booking_addons WHERE booking_id = ? ORDER BY sort_order, created_at',
      [req.params.id]
    );
    booking.addons = addons || [];
  } catch (err) {
    console.warn('[Booking detail] booking_addons unavailable:', err.message);
    booking.addons = [];
  }

  res.json(booking);
});

/** Admin: permanently delete a booking and related room/add-on rows (CASCADE). */
router.delete('/admin/:id', authenticateAdmin, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, reference_code, guest_name FROM bookings WHERE id = ?',
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

  await pool.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
  res.json({
    message: 'Booking deleted',
    reference_code: rows[0].reference_code,
  });
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

    res.json({
      message: 'Payment proof uploaded. Our team will verify shortly.',
      email_sent: false,
      email_pending: sendAcknowledgmentEmail,
    });

    if (sendAcknowledgmentEmail) {
      prepareBookingForEmail(pool, { ...booking, status: 'payment_submitted' })
        .then((emailBooking) =>
          sendPaymentProofReceivedEmail(emailBooking, { name: emailBooking.room_name })
        )
        .then((emailResult) => {
          if (!emailResult.sent) {
            console.warn('[Payment proof] Guest email not sent:', emailResult.reason, emailResult.hint || '');
          }
        })
        .catch((err) => console.error('[Payment proof] Guest email error:', err.message));
    }
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

// Public: upload PWD ID for island hopping passenger
router.post(
  '/:reference/pwd-id',
  uploadPwdId.single('id'),
  async (req, res) => {
    const code = req.params.reference.toUpperCase();
    const passengerIndex = parseInt(req.body.passenger_index, 10);

    if (!Number.isFinite(passengerIndex) || passengerIndex < 0) {
      return res.status(400).json({ message: 'Valid passenger_index is required' });
    }
    if (!req.file) return res.status(400).json({ message: 'PWD ID file required' });

    const [rows] = await pool.query('SELECT * FROM bookings WHERE reference_code = ?', [code]);
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

    const booking = rows[0];
    if (!booking.island_hopping) {
      return res.status(400).json({ message: 'This booking does not include island hopping' });
    }

    const { parseIslandHoppingData, isPwdPassenger } = await import('../utils/islandHopping.js');
    const islandData = parseIslandHoppingData(booking.island_hopping_data);
    if (!islandData?.passengers?.length) {
      return res.status(400).json({ message: 'Island hopping passenger list not found' });
    }
    if (passengerIndex >= islandData.passengers.length) {
      return res.status(400).json({ message: 'Invalid passenger index' });
    }

    const passenger = islandData.passengers[passengerIndex];
    if (!isPwdPassenger(passenger)) {
      return res.status(400).json({ message: 'PWD ID is only required for guests marked as PWD' });
    }

    const isPdf = req.file.mimetype === 'application/pdf';
    const { url: idUrl, publicId } = await uploadFile(req.file.buffer, 'pwd-ids', {
      originalName: req.file.originalname,
      resourceType: isPdf ? 'raw' : 'image',
    });

    islandData.passengers[passengerIndex] = {
      ...passenger,
      pwd_id_url: idUrl,
      pwd_id_public_id: publicId,
    };

    await pool.query('UPDATE bookings SET island_hopping_data = ? WHERE id = ?', [
      JSON.stringify(islandData),
      booking.id,
    ]);

    res.json({
      message: 'PWD ID uploaded.',
      passenger_index: passengerIndex,
      pwd_id_url: idUrl,
    });
  }
);

export default router;
