-- Caza Buena Booking Management Database
-- Run: mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS caza_buena CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE caza_buena;

-- Admin users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Resort rooms / accommodation
CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  room_type ENUM('suite', 'queen') NOT NULL DEFAULT 'queen',
  slug VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  short_description VARCHAR(500),
  capacity INT NOT NULL DEFAULT 2,
  included_adults INT NOT NULL DEFAULT 2 COMMENT 'Adults included in base nightly rate',
  min_guests INT NOT NULL DEFAULT 1 COMMENT 'Minimum guests per booking',
  max_guests INT NOT NULL DEFAULT 2 COMMENT 'Maximum guests per booking',
  price_per_night DECIMAL(10, 2) NOT NULL COMMENT 'Weekday rate (Mon-Thu)',
  price_weekend DECIMAL(10, 2) NULL COMMENT 'Fri-Sun rate; defaults to weekday if null',
  amenities_json JSON,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  cloudinary_public_id VARCHAR(255),
  is_primary TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Holiday / special date pricing (overrides weekday & weekend)
CREATE TABLE IF NOT EXISTS room_holiday_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  label VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_per_night DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Room availability blocks (admin-managed)
CREATE TABLE IF NOT EXISTS room_unavailability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(255),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Resort amenities (facilities page)
CREATE TABLE IF NOT EXISTS amenities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  image_url VARCHAR(500),
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1
);

-- Photo gallery
CREATE TABLE IF NOT EXISTS gallery_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150),
  image_url VARCHAR(500) NOT NULL,
  cloudinary_public_id VARCHAR(255),
  category VARCHAR(50) DEFAULT 'general',
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QR payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('gcash', 'maya', 'bdo', 'bpi', 'other') NOT NULL,
  account_name VARCHAR(150),
  account_number VARCHAR(100),
  qr_image_url VARCHAR(500),
  instructions TEXT,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0
);

-- Discount codes
CREATE TABLE IF NOT EXISTS discounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  type ENUM('percentage', 'fixed') NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  min_nights INT DEFAULT 1,
  valid_from DATE,
  valid_until DATE,
  max_uses INT,
  used_count INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_code VARCHAR(20) NOT NULL UNIQUE,
  room_id INT NOT NULL,
  guest_name VARCHAR(150) NOT NULL,
  guest_email VARCHAR(150) NOT NULL,
  guest_phone VARCHAR(30) NOT NULL,
  valid_id VARCHAR(255),
  estimated_arrival VARCHAR(100),
  guest_count INT NOT NULL DEFAULT 1,
  adults INT,
  children_under6 INT NOT NULL DEFAULT 0,
  children_7_12 INT NOT NULL DEFAULT 0,
  special_requests TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INT NOT NULL,
  room_rate DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  discount_code VARCHAR(50),
  discount_note VARCHAR(255) NULL COMMENT 'Admin manual discount reason',
  total_amount DECIMAL(10, 2) NOT NULL,
  extra_person_charges DECIMAL(10, 2) NOT NULL DEFAULT 0,
  island_hopping TINYINT(1) NOT NULL DEFAULT 0,
  island_hopping_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  island_hopping_data JSON NULL,
  bringing_car TINYINT(1) NOT NULL DEFAULT 0,
  car_count INT NOT NULL DEFAULT 0,
  pet_count INT NOT NULL DEFAULT 0,
  pet_deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  bilao_package VARCHAR(20),
  bilao_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  boodle_fight TINYINT(1) NOT NULL DEFAULT 0,
  boodle_fight_tier VARCHAR(20),
  boodle_fight_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stay_addons JSON NULL COMMENT 'During-stay charges (room extension, food, etc.)',
  status ENUM(
    'pending',
    'awaiting_payment',
    'payment_submitted',
    'confirmed',
    'rejected',
    'cancelled'
  ) DEFAULT 'pending',
  payment_method_id INT,
  payment_option ENUM('deposit', 'full', 'custom') NOT NULL DEFAULT 'deposit',
  amount_to_pay DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT 'Amount guest will pay now (DP, full, or custom)',
  payment_proof_url VARCHAR(500),
  payment_proof_public_id VARCHAR(255),
  admin_notes TEXT,
  rejection_reason TEXT,
  confirmed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS booking_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  room_id INT NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children_under6 INT NOT NULL DEFAULT 0,
  children_7_12 INT NOT NULL DEFAULT 0,
  guest_count INT NOT NULL DEFAULT 1,
  nights INT NOT NULL,
  room_rate DECIMAL(10, 2) NOT NULL,
  room_subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  extra_person_charges DECIMAL(10, 2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  UNIQUE KEY uq_booking_room (booking_id, room_id)
);

-- Custom booking add-ons (room extension, food, etc.) for SOA / confirmation
CREATE TABLE IF NOT EXISTS booking_addons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  label VARCHAR(150) NOT NULL COMMENT 'Display label e.g., Room Extension, Ordered Food',
  description VARCHAR(500) NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  include_in_soa TINYINT(1) DEFAULT 1 COMMENT 'Include in SOA',
  include_in_confirmation TINYINT(1) DEFAULT 1 COMMENT 'Include in booking confirmation',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_booking_id (booking_id)
);

-- FAQ entries
CREATE TABLE IF NOT EXISTS faqs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question VARCHAR(500) NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1
);

-- Café menu items (Meals page)
CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(500),
  cloudinary_public_id VARCHAR(255),
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Resort policies
CREATE TABLE IF NOT EXISTS policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1
);

-- Contact form inquiries
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  subject VARCHAR(200),
  message TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Site settings (key-value)
CREATE TABLE IF NOT EXISTS site_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
