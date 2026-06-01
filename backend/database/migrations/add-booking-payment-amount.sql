USE caza_buena;

ALTER TABLE bookings
  ADD COLUMN payment_option ENUM('deposit', 'full', 'custom') NOT NULL DEFAULT 'deposit' AFTER payment_method_id,
  ADD COLUMN amount_to_pay DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER payment_option;

UPDATE bookings SET amount_to_pay = total_amount WHERE amount_to_pay = 0 OR amount_to_pay IS NULL;

UPDATE site_settings SET setting_value = '20' WHERE setting_key = 'booking_deposit_percent';
