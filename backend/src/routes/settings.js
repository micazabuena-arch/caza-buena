import { Router } from 'express';
import pool from '../config/database.js';
import { DEFAULT_DEPOSIT_PERCENT, getDepositPercent } from '../utils/paymentAmount.js';

const router = Router();

/** Public booking-related settings for the website */
router.get('/public', async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM site_settings
     WHERE setting_key IN ('booking_deposit_percent', 'resort_name')`
  );
  const map = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  res.json({
    booking_deposit_percent: getDepositPercent(map.booking_deposit_percent ?? DEFAULT_DEPOSIT_PERCENT),
    resort_name: map.resort_name || 'Caza Buena',
  });
});

export default router;
