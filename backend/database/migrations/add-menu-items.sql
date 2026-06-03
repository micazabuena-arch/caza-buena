-- Menu / café items for the Meals page
-- Run in phpMyAdmin on your database if the table does not exist yet.

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

-- Default items are seeded automatically when the API starts (see backend/src/config/seed.js).
-- Or run the INSERT statements from seed.js manually if you prefer.
