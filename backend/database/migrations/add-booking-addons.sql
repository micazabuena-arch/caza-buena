-- Booking Add-ons Table
-- Allows admin to add custom charges like room extensions, ordered food, etc.
-- These can appear in SOA and/or booking confirmation separately

CREATE TABLE IF NOT EXISTS booking_addons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  label VARCHAR(150) NOT NULL COMMENT 'Display label e.g., Room Extension, Ordered Food',
  description VARCHAR(500) COMMENT 'Optional details',
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  include_in_soa TINYINT(1) DEFAULT 1 COMMENT 'Include in SOA',
  include_in_confirmation TINYINT(1) DEFAULT 1 COMMENT 'Include in booking confirmation',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_booking_id (booking_id)
);
