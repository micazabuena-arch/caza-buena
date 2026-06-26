/**
 * Applies pending DB columns safely (skips columns that already exist).
 * Run from backend folder: npm run migrate
 */
import pool from '../src/config/database.js';

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0].c) > 0;
}

async function addColumn(table, column, definition) {
  if (await columnExists(table, column)) {
    console.log(`  ✓ ${table}.${column} (already exists)`);
    return false;
  }
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  + added ${table}.${column}`);
  return true;
}

async function run() {
  console.log('Caza Buena — database migration\n');

  const [dbRow] = await pool.query('SELECT DATABASE() AS db');
  console.log(`Database: ${dbRow[0].db}\n`);

  console.log('rooms table:');
  await addColumn('rooms', 'room_type', "ENUM('suite', 'queen') NOT NULL DEFAULT 'queen' AFTER `name`");
  await addColumn(
    'rooms',
    'price_weekend',
    'DECIMAL(10, 2) NULL AFTER `price_per_night`'
  );
  await addColumn(
    'rooms',
    'included_adults',
    "INT NOT NULL DEFAULT 2 COMMENT 'Adults in base rate' AFTER `capacity`"
  );
  await addColumn(
    'rooms',
    'min_guests',
    "INT NOT NULL DEFAULT 1 COMMENT 'Min guests per booking' AFTER `included_adults`"
  );
  await addColumn(
    'rooms',
    'max_guests',
    "INT NULL COMMENT 'Max guests per booking' AFTER `min_guests`"
  );

  await pool.query(
    'UPDATE rooms SET max_guests = capacity WHERE max_guests IS NULL AND capacity IS NOT NULL'
  );
  await pool.query(
    "UPDATE rooms SET room_type = 'suite' WHERE room_type = 'queen' AND (capacity >= 8 OR name LIKE '%SUITE%' OR slug LIKE '%suite%')"
  );

  console.log('\nbookings table:');
  await addColumn('bookings', 'adults', 'INT NULL AFTER `guest_count`');
  await addColumn('bookings', 'children_under6', 'INT NOT NULL DEFAULT 0 AFTER `adults`');
  await addColumn('bookings', 'children_7_12', 'INT NOT NULL DEFAULT 0 AFTER `children_under6`');
  await addColumn('bookings', 'valid_id', 'VARCHAR(255) NULL AFTER `guest_phone`');
  await addColumn('bookings', 'estimated_arrival', 'VARCHAR(100) NULL AFTER `valid_id`');
  await addColumn(
    'bookings',
    'extra_person_charges',
    'DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `total_amount`'
  );

  await pool.query('UPDATE bookings SET adults = guest_count WHERE adults IS NULL');

  await addColumn(
    'bookings',
    'payment_option',
    "ENUM('deposit', 'full', 'custom') NOT NULL DEFAULT 'deposit' AFTER `payment_method_id`"
  );
  await addColumn(
    'bookings',
    'amount_to_pay',
    'DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `payment_option`'
  );
  await pool.query(
    'UPDATE bookings SET amount_to_pay = total_amount WHERE amount_to_pay IS NULL OR amount_to_pay = 0'
  );
  // Keep pay-now policy consistent across environments.
  await pool.query(
    "UPDATE site_settings SET setting_value = '20' WHERE setting_key = 'booking_deposit_percent'"
  );

  await addColumn(
    'bookings',
    'island_hopping',
    'TINYINT(1) NOT NULL DEFAULT 0 AFTER `extra_person_charges`'
  );
  await addColumn(
    'bookings',
    'island_hopping_amount',
    'DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `island_hopping`'
  );
  await addColumn(
    'bookings',
    'island_hopping_data',
    'JSON NULL AFTER `island_hopping_amount`'
  );

  console.log('\nbookings table (extras):');
  await addColumn(
    'bookings',
    'bringing_car',
    'TINYINT(1) NOT NULL DEFAULT 0 AFTER `island_hopping_data`'
  );
  await addColumn('bookings', 'car_count', 'INT NOT NULL DEFAULT 0 AFTER `bringing_car`');
  await addColumn('bookings', 'pet_count', 'INT NOT NULL DEFAULT 0 AFTER `car_count`');
  await addColumn(
    'bookings',
    'pet_deposit_amount',
    'DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `pet_count`'
  );
  await addColumn('bookings', 'bilao_package', 'VARCHAR(20) NULL AFTER `pet_deposit_amount`');
  await addColumn(
    'bookings',
    'bilao_amount',
    'DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `bilao_package`'
  );
  await addColumn(
    'bookings',
    'boodle_fight',
    'TINYINT(1) NOT NULL DEFAULT 0 AFTER `bilao_amount`'
  );
  await addColumn('bookings', 'boodle_fight_tier', 'VARCHAR(20) NULL AFTER `boodle_fight`');
  await addColumn(
    'bookings',
    'boodle_fight_amount',
    'DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `boodle_fight_tier`'
  );

  const [holidayTable] = await pool.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'room_holiday_rates'`
  );
  if (Number(holidayTable[0].c) === 0) {
    await pool.query(`
      CREATE TABLE room_holiday_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        label VARCHAR(150) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        price_per_night DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);
    console.log('  + created room_holiday_rates');
  } else {
    console.log('  ✓ room_holiday_rates (already exists)');
  }

  const [menuTable] = await pool.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items'`
  );
  if (Number(menuTable[0].c) === 0) {
    await pool.query(`
      CREATE TABLE menu_items (
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
      )
    `);
    console.log('  + created menu_items');
  } else {
    console.log('  ✓ menu_items (already exists)');
  }

  await pool.query(
    'UPDATE rooms SET price_weekend = ROUND(price_per_night * 1.2, 2) WHERE price_weekend IS NULL'
  );

  console.log('\nroom descriptions (fix ?? encoding):');
  const [descFix] = await pool.query(`
    UPDATE rooms SET short_description = CONCAT(
      IF(room_type = 'suite', 'Two-bedroom suite', 'One-bedroom queen'),
      ' - Floor ',
      FLOOR(sort_order / 100)
    )
    WHERE sort_order >= 100
  `);
  console.log(`  updated ${descFix.affectedRows} room short_description row(s)`);

  const [imgFix] = await pool.query(`
    UPDATE room_images SET image_url = 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800'
    WHERE image_url LIKE '%1611892440504%'
  `);
  if (imgFix.affectedRows > 0) {
    console.log(`  fixed ${imgFix.affectedRows} broken room image URL(s)`);
  }

  console.log('\nsite contact phone:');
  await pool.query(
    "INSERT INTO site_settings (setting_key, setting_value) VALUES ('phone', '0947 191 8080') ON DUPLICATE KEY UPDATE setting_value = '0947 191 8080'"
  );
  console.log('  updated site_settings.phone → 0947 191 8080');

  console.log('\nextra guest rates:');
  await pool.query(
    "INSERT INTO site_settings (setting_key, setting_value) VALUES ('extra_pax_adult_weekday', '800') ON DUPLICATE KEY UPDATE setting_value = setting_value"
  );
  await pool.query(
    "INSERT INTO site_settings (setting_key, setting_value) VALUES ('extra_pax_adult_weekend', '900') ON DUPLICATE KEY UPDATE setting_value = setting_value"
  );
  await pool.query(
    "INSERT INTO site_settings (setting_key, setting_value) VALUES ('extra_pax_child_7_12', '400') ON DUPLICATE KEY UPDATE setting_value = setting_value"
  );
  console.log('  ✓ extra_pax_* settings (defaults if new)');

  const [payUpdate] = await pool.query(
    "UPDATE payment_methods SET account_number = '09471918080' WHERE account_number IN ('09157118212', '09178290292', '+639178290292', '+63 917 829 0292')"
  );
  if (payUpdate.affectedRows > 0) {
    console.log(`  updated ${payUpdate.affectedRows} payment method account number(s)`);
  }

  console.log('\npayment_methods:');
  const [platformDelete] = await pool.query(
    "DELETE FROM payment_methods WHERE name = 'Online Booking Platform'"
  );
  if (platformDelete.affectedRows > 0) {
    console.log(`  removed ${platformDelete.affectedRows} Online Booking Platform row(s) from payment_methods`);
  } else {
    console.log('  ✓ Online Booking Platform not in payment_methods');
  }

  console.log('\nDone. Restart the API (npm run dev) and try saving the room again.');
  await pool.end();
}

run().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
