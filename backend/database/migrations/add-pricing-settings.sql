-- Island hopping + food add-on defaults in site_settings (safe to re-run).
-- Run in phpMyAdmin or: cd backend && npm run migrate

INSERT INTO site_settings (setting_key, setting_value)
VALUES (
  'island_hopping_rates',
  '{"entrance":{"infant":{"maxAge":4,"label":"Entrance fee (0-4 years old)","rate":20},"regular":{"minAge":5,"maxAge":59,"label":"Entrance fee (5-59 years old)","rate":130},"senior":{"label":"Senior citizen (with 20% discount)","rate":108},"pwd":{"label":"PWD (with 20% discount)","rate":108}},"boat":[{"id":"small","label":"SMALL (1-5 PAX)","min":1,"max":5,"rate":1600},{"id":"medium","label":"MEDIUM (6-10 PAX)","min":6,"max":10,"rate":2000},{"id":"large","label":"LARGE (11-15 PAX)","min":11,"max":15,"rate":2400},{"id":"deluxe","label":"DELUXE (16-20 PAX)","min":16,"max":20,"rate":2800}],"facilitationFee":300,"deluxeFacilitationFee":500,"garbageFee":200,"maxPassengersPerBoat":20,"maxPassengers":20}'
)
ON DUPLICATE KEY UPDATE setting_value = setting_value;

INSERT INTO site_settings (setting_key, setting_value)
VALUES (
  'food_add_on_rates',
  '{"bilao":[{"id":"small","label":"Small","pax":4,"price":1500},{"id":"medium","label":"Medium","pax":7,"price":2000},{"id":"large","label":"Large","pax":10,"price":3000},{"id":"xlarge","label":"X-Large","pax":15,"price":3500}],"boodle":[{"id":"2-5","label":"2-5 pax","price":5000},{"id":"6-8","label":"6-8 pax","price":6000},{"id":"9-11","label":"9-11 pax","price":6500},{"id":"12-15","label":"12-15 pax","price":7000},{"id":"16-20","label":"16-20 pax","price":11000},{"id":"20-25","label":"20-25 pax","price":13000}],"petDepositPerPet":500}'
)
ON DUPLICATE KEY UPDATE setting_value = setting_value;
