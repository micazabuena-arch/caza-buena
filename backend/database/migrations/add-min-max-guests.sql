USE caza_buena;

ALTER TABLE rooms
  ADD COLUMN min_guests INT NOT NULL DEFAULT 1 COMMENT 'Minimum guests per booking' AFTER included_adults,
  ADD COLUMN max_guests INT NULL COMMENT 'Maximum guests per booking' AFTER min_guests;

UPDATE rooms SET max_guests = capacity WHERE max_guests IS NULL;
