-- Run in phpMyAdmin on database `caza_buena` if you cannot use: npm run migrate
-- If a column already exists, skip that ALTER line or ignore the error.

USE caza_buena;

ALTER TABLE rooms
  ADD COLUMN room_type ENUM('suite', 'queen') NOT NULL DEFAULT 'queen' AFTER name;

ALTER TABLE rooms
  ADD COLUMN price_weekend DECIMAL(10, 2) NULL AFTER price_per_night;

ALTER TABLE rooms
  ADD COLUMN included_adults INT NOT NULL DEFAULT 2 COMMENT 'Adults in base rate' AFTER capacity;

ALTER TABLE rooms
  ADD COLUMN min_guests INT NOT NULL DEFAULT 1 COMMENT 'Min guests' AFTER included_adults;

ALTER TABLE rooms
  ADD COLUMN max_guests INT NULL COMMENT 'Max guests' AFTER min_guests;

UPDATE rooms SET max_guests = capacity WHERE max_guests IS NULL;

ALTER TABLE bookings ADD COLUMN adults INT NULL AFTER guest_count;
ALTER TABLE bookings ADD COLUMN children_under6 INT NOT NULL DEFAULT 0 AFTER adults;
ALTER TABLE bookings ADD COLUMN children_7_12 INT NOT NULL DEFAULT 0 AFTER children_under6;
ALTER TABLE bookings ADD COLUMN valid_id VARCHAR(255) NULL AFTER guest_phone;
ALTER TABLE bookings ADD COLUMN estimated_arrival VARCHAR(100) NULL AFTER valid_id;
ALTER TABLE bookings ADD COLUMN extra_person_charges DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER total_amount;

UPDATE bookings SET adults = guest_count WHERE adults IS NULL;
