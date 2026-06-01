-- Update existing suite units to reflect two-bedroom layout
UPDATE rooms
SET
  description = 'Spacious two-bedroom Suite Room with Santorini-inspired interiors—ideal for families and groups.',
  short_description = CONCAT('Two-bedroom suite · Floor ', FLOOR(sort_order / 100)),
  amenities_json = '["2 bedrooms","Queen-size beds","Air conditioning","En-suite bathroom","Smart projector","Fast Wi-Fi","Complimentary breakfast"]'
WHERE room_type = 'suite';
