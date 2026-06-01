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

  await pool.query(
    'UPDATE rooms SET price_weekend = ROUND(price_per_night * 1.2, 2) WHERE price_weekend IS NULL'
  );

  console.log('\nDone. Restart the API (npm run dev) and try saving the room again.');
  await pool.end();
}

run().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
