-- Run after add-resort-room-types.sql
-- Deactivates placeholder rooms and inserts Caza Buena unit inventory
USE caza_buena;

UPDATE rooms SET is_active = 0
WHERE slug IN ('aegean-suite', 'cyclades-room', 'lucap-dorm-pod');

INSERT INTO rooms (name, room_type, slug, description, short_description, capacity, included_adults, price_per_night, price_weekend, amenities_json, is_active, sort_order) VALUES
('ROOM 101', 'suite', 'room-101',
 'Spacious two-bedroom Suite Room with Santorini-inspired interiors—ideal for families and groups.',
 'Two-bedroom suite - Floor 1', 12, 8, 4500.00, 5400.00,
 '["2 bedrooms","Queen-size beds","Air conditioning","En-suite bathroom","Smart projector","Fast Wi-Fi","Complimentary breakfast"]', 1, 101),
('ROOM 201', 'suite', 'room-201',
 'Spacious two-bedroom Suite Room with Santorini-inspired interiors—ideal for families and groups.',
 'Two-bedroom suite - Floor 2', 12, 8, 4500.00, 5400.00,
 '["2 bedrooms","Queen-size beds","Air conditioning","En-suite bathroom","Smart projector","Fast Wi-Fi","Complimentary breakfast"]', 1, 201),
('ROOM 301', 'suite', 'room-301',
 'Spacious two-bedroom Suite Room with Santorini-inspired interiors—ideal for families and groups.',
 'Two-bedroom suite - Floor 3', 12, 8, 4500.00, 5400.00,
 '["2 bedrooms","Queen-size beds","Air conditioning","En-suite bathroom","Smart projector","Fast Wi-Fi","Complimentary breakfast"]', 1, 301),
('ROOM 102', 'queen', 'room-102',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen - Floor 1', 5, 2, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 102),
('ROOM 103', 'queen', 'room-103',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen - Floor 1', 5, 2, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 103),
('ROOM 202', 'queen', 'room-202',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen - Floor 2', 5, 2, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 202),
('ROOM 203', 'queen', 'room-203',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen - Floor 2', 5, 2, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 203),
('ROOM 302', 'queen', 'room-302',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen - Floor 3', 5, 2, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 302),
('ROOM 303', 'queen', 'room-303',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen - Floor 3', 5, 2, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 303)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  room_type = VALUES(room_type),
  description = VALUES(description),
  short_description = VALUES(short_description),
  capacity = VALUES(capacity),
  included_adults = VALUES(included_adults),
  is_active = VALUES(is_active),
  sort_order = VALUES(sort_order);
