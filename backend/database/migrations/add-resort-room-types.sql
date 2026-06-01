USE caza_buena;

ALTER TABLE rooms
  ADD COLUMN room_type ENUM('suite', 'queen') NOT NULL DEFAULT 'queen' AFTER name,
  ADD COLUMN included_adults INT NOT NULL DEFAULT 2 COMMENT 'Adults included in base nightly rate' AFTER capacity;

ALTER TABLE bookings
  ADD COLUMN adults INT NULL AFTER guest_count,
  ADD COLUMN children_under6 INT NOT NULL DEFAULT 0 AFTER adults,
  ADD COLUMN children_7_12 INT NOT NULL DEFAULT 0 AFTER children_under6,
  ADD COLUMN valid_id VARCHAR(255) NULL AFTER guest_phone,
  ADD COLUMN estimated_arrival VARCHAR(100) NULL AFTER valid_id,
  ADD COLUMN extra_person_charges DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER total_amount;

UPDATE bookings SET adults = guest_count WHERE adults IS NULL;
