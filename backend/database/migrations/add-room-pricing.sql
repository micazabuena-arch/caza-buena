-- Run on existing database: mysql -u root caza_buena < database/migrations/add-room-pricing.sql
USE caza_buena;

ALTER TABLE rooms
  ADD COLUMN price_weekend DECIMAL(10, 2) NULL AFTER price_per_night;

-- Holiday / peak date pricing per room
CREATE TABLE IF NOT EXISTS room_holiday_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  label VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_per_night DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_room_dates (room_id, start_date, end_date)
);

-- Default weekend = +20% of weekday if not set
UPDATE rooms SET price_weekend = ROUND(price_per_night * 1.2, 2) WHERE price_weekend IS NULL;
