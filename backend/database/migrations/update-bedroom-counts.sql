-- Suite = 2 bedrooms; Queen = 1 bedroom (run on existing database)

UPDATE rooms
SET
  description = 'Spacious two-bedroom Suite Room with Santorini-inspired interiors—ideal for families and groups.',
  short_description = CONCAT('Two-bedroom suite · Floor ', FLOOR(sort_order / 100)),
  amenities_json = '["2 bedrooms","Queen-size beds","Air conditioning","En-suite bathroom","Smart projector","Fast Wi-Fi","Complimentary breakfast"]'
WHERE room_type = 'suite';

UPDATE rooms
SET
  description = 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
  short_description = CONCAT('One-bedroom queen · Floor ', FLOOR(sort_order / 100)),
  amenities_json = '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]'
WHERE room_type = 'queen';
