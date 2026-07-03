-- During-stay add-ons (room extension, food orders, etc.)
ALTER TABLE bookings
  ADD COLUMN stay_addons JSON NULL COMMENT 'During-stay charges (room extension, food, etc.)' AFTER boodle_fight_amount;
