-- Sync included_adults with admin max guests where needed (run after setting capacity in Admin)
USE caza_buena;

-- Example: ROOM 101 with max 8 guests — set both fields to match
-- UPDATE rooms SET capacity = 8, included_adults = 8 WHERE slug = 'room-101';
