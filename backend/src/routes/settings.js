import { Router } from 'express';
import pool from '../config/database.js';
import { DEFAULT_DEPOSIT_PERCENT, getDepositPercent } from '../utils/paymentAmount.js';
import { getExtraPersonRates } from '../utils/extraPersonRates.js';
import { getIslandHoppingRates } from '../utils/islandHoppingRatesStore.js';
import { getFoodAddOnRatesPublic } from '../utils/foodAddOnRatesStore.js';

const router = Router();

/** Public booking-related settings for the website */
router.get('/public', async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM site_settings
     WHERE setting_key IN ('booking_deposit_percent', 'resort_name')`
  );
  const map = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  const extra_person_rates = await getExtraPersonRates(pool);
  const island_hopping_rates = await getIslandHoppingRates(pool);
  const food_add_on_rates = await getFoodAddOnRatesPublic(pool);
  res.json({
    booking_deposit_percent: getDepositPercent(map.booking_deposit_percent ?? DEFAULT_DEPOSIT_PERCENT),
    resort_name: map.resort_name || 'Caza Buena',
    extra_person_rates,
    island_hopping_rates,
    food_add_on_rates,
  });
});

export default router;
