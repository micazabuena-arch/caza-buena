USE caza_buena;

-- Default admin is created by the API on first run (see src/config/seed.js)

INSERT INTO site_settings (setting_key, setting_value) VALUES
('resort_name', 'Caza Buena'),
('tagline', 'Your home after the sea'),
('address', 'Sitio Inansuana, Brgy. Lucap, Alaminos, Pangasinan'),
('phone', '+63 917 829 0292'),
('email', 'mi.caza.buena@gmail.com'),
('instagram', 'https://www.instagram.com/cazabuena_'),
('facebook', 'https://www.facebook.com/profile.php?id=61557575977651'),
('check_in_time', '1:00 PM'),
('check_out_time', '11:00 AM'),
('dot_accredited', 'DEPARTMENT OF TOURISM (DOT) Accredited'),
('hero_subtitle', 'Book the Santorini vibe—no passport needed.'),
('booking_deposit_percent', '20');

-- Resort units: 3 Suite + 6 Queen
INSERT INTO rooms (name, room_type, slug, description, short_description, capacity, included_adults, min_guests, max_guests, price_per_night, price_weekend, amenities_json, is_active, sort_order) VALUES
('ROOM 101', 'suite', 'room-101',
 'Spacious two-bedroom Suite Room with Santorini-inspired interiors—ideal for families and groups.',
 'Two-bedroom suite · Floor 1', 8, 8, 1, 8, 4500.00, 5400.00,
 '["2 bedrooms","Queen-size beds","Air conditioning","En-suite bathroom","Smart projector","Fast Wi-Fi","Complimentary breakfast"]', 1, 101),
('ROOM 201', 'suite', 'room-201',
 'Spacious two-bedroom Suite Room with Santorini-inspired interiors—ideal for families and groups.',
 'Two-bedroom suite · Floor 2', 8, 8, 1, 8, 4500.00, 5400.00,
 '["2 bedrooms","Queen-size beds","Air conditioning","En-suite bathroom","Smart projector","Fast Wi-Fi","Complimentary breakfast"]', 1, 201),
('ROOM 301', 'suite', 'room-301',
 'Spacious two-bedroom Suite Room with Santorini-inspired interiors—ideal for families and groups.',
 'Two-bedroom suite · Floor 3', 8, 8, 1, 8, 4500.00, 5400.00,
 '["2 bedrooms","Queen-size beds","Air conditioning","En-suite bathroom","Smart projector","Fast Wi-Fi","Complimentary breakfast"]', 1, 301),
('ROOM 102', 'queen', 'room-102',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen · Floor 1', 5, 2, 1, 5, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 102),
('ROOM 103', 'queen', 'room-103',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen · Floor 1', 5, 2, 1, 5, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 103),
('ROOM 202', 'queen', 'room-202',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen · Floor 2', 5, 2, 1, 5, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 202),
('ROOM 203', 'queen', 'room-203',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen · Floor 2', 5, 2, 1, 5, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 203),
('ROOM 302', 'queen', 'room-302',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen · Floor 3', 5, 2, 1, 5, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 302),
('ROOM 303', 'queen', 'room-303',
 'One-bedroom Queen Room for couples, triple, or quad stays—cozy Mediterranean charm.',
 'One-bedroom queen · Floor 3', 5, 2, 1, 5, 3200.00, 3840.00,
 '["1 bedroom","Queen bed","Air conditioning","En-suite bathroom","Fast Wi-Fi"]', 1, 303);

INSERT INTO room_images (room_id, image_url, is_primary, sort_order) VALUES
(1, 'https://images.unsplash.com/photo-1611892440504-42a784e83da7?w=800', 1, 0),
(4, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800', 1, 0);

INSERT INTO amenities (title, description, icon, sort_order) VALUES
('Infinity Pool', 'Salt-kissed pool overlooking Lucap—perfect for sunset dips.', 'Waves', 1),
('Café & Lounge', 'Mediterranean bites, specialty coffee, and island-day cocktails.', 'Coffee', 2),
('Island Tour Desk', 'DOT-accredited guides for Hundred Islands boat trips.', 'MapPin', 3),
('Free Wi-Fi', 'Stay connected across the property.', 'Wifi', 4),
('Parking', 'Secure parking for guests with vehicles.', 'Car', 5),
('Beach Shuttle', 'Complimentary shuttle to nearby beaches (seasonal).', 'Bus', 6);

INSERT INTO gallery_images (title, image_url, category, sort_order) VALUES
('Santorini Terrace', 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800', 'exterior', 1),
('Pool at Dusk', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800', 'amenities', 2),
('Aegean Breakfast', 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800', 'dining', 3),
('Whitewashed Walkway', 'https://images.unsplash.com/photo-1582719508461-905c59372395?w=800', 'exterior', 4);

INSERT INTO payment_methods (name, type, account_name, account_number, instructions, sort_order) VALUES
('GCash', 'gcash', 'Caza Buena', '09178290292',
 'Scan the GCash QR code. Use your booking reference as payment notes.', 1),
('Maya', 'maya', 'Caza Buena', '09178290292',
 'Scan the Maya QR code. Screenshot your receipt after payment.', 2),
('BDO Bank Transfer', 'bdo', 'Caza Buena Resort', '0000000000',
 'Transfer to BDO account. Email or upload proof of payment.', 3),
('BPI Bank Transfer', 'bpi', 'Caza Buena Resort', '0000000000',
 'Transfer to BPI account. Include booking reference in remarks.', 4);

INSERT INTO discounts (code, description, type, value, min_nights, is_active) VALUES
('WELCOME10', '10% off your first stay', 'percentage', 10.00, 1, 1),
('ISLAND500', 'PHP 500 off 2+ night stays', 'fixed', 500.00, 2, 1);

INSERT INTO faqs (question, answer, category, sort_order) VALUES
('What are check-in and check-out times?',
 'Check-in is at 1:00 PM and check-out is at 11:00 AM. Early check-in may be arranged subject to availability.',
 'booking', 1),
('How do I pay for my booking?',
 'We accept QR payments via GCash, Maya, and bank transfer (BDO/BPI). After submitting your booking request, you will receive payment instructions and can upload proof of payment on our website.',
 'payment', 2),
('When is my booking confirmed?',
 'Your booking is confirmed once our team verifies your payment. You will receive a confirmation email.',
 'booking', 3),
('Is Caza Buena DOT accredited?',
 'Yes. Caza Buena is accredited by the Department of Tourism (DOT).',
 'general', 4),
('Where is Caza Buena located?',
 'We are located at Inansuana St., Barangay Lucap, Alaminos, Pangasinan.\n\n• 7-minute walk from Lucap Wharf\n• 2-minute drive from Lucap Wharf\n\nNearest landmark: Sitio Inansuana Basketball Court',
 'location', 5),
('Are you beachfront?',
 'We are not beachfront. We are a 7-minute walk to and from the Hundred Islands Wharf/port. The Hundred Islands is the nearest beach experience from Caza Buena.\n\nIf you want to visit beaches near us without riding a boat, we suggest Bolo Beach or Masamirey Beach.',
 'location', 6),
('What islands should we visit during island hopping?',
 'Top islands to visit during your island hopping:\n\nPilgrimage Island\n• Statue of Christ the Savior\n• Sightseeing & photos\n• Quiet reflection\n\nGovernor''s Island\n• View deck (best panoramic photo spot)\n• Short hike\n• Swimming\n\nQuezon Island\n• Beach swimming\n• Water activities and zipline\n• Kayaking or banana boat (if available)\n\nMarcos Island\n• Cave exploration (Imelda Cave)\n• Cliff jumping\n• Swimming\n\nChildren''s Island\n• Fine sand beach\n• Relaxing swim\n• Great for photos\n\nScout Island (or Coral Garden area)\n• Snorkeling\n• Fish feeding\n• Clear shallow waters\n\nThese are just some of the 100+ islands we suggest—there is much more to see!',
 'island-hopping', 7),
('How does the island hopping tour work?',
 'Hundred Islands Tour Coordination\n\nIf you would like us to assist you in arranging your Hundred Islands tour, please review the information below.\n\nPlease note that we do not own or operate the boat tours. The Hundred Islands National Park tours are exclusively managed and offered by the Local Department of Tourism.\n\nRegistration & Timing: The tourism office opens at 6:00 AM for registration (registration time is from 7:00 AM until 3:00 PM). We highly recommend starting your island-hopping adventure around 7:00 AM.\n\nAt the Wharf: Upon arrival, you will meet the tour facilitator who will assist you to your assigned boat.\n\nYour Itinerary: Your boatman has a standard itinerary guide to follow. However, since your group is renting a private boat, you are welcome to suggest specific islands you would like to visit or spend more time on.\n\nSchedule Flexibility: The tour schedule is highly flexible. You can head out anytime between 7:00 AM and 3:00 PM, and you may return to the wharf whenever you are ready, provided it is no later than 5:00 PM.',
 'island-hopping', 8);

INSERT INTO policies (title, slug, content, sort_order) VALUES
('Reservation Policy', 'reservation',
 'All bookings are subject to availability. A reservation request does not guarantee a room until payment is verified and confirmation is sent by our team.', 1),
('Cancellation Policy', 'cancellation',
 'Cancellations made 7 days before check-in receive a full refund of verified payments. Cancellations within 7 days may incur a 50% charge. No-shows are non-refundable.', 2),
('Payment Policy', 'payment',
 'Full payment or the required deposit (as indicated at booking) must be completed via our accepted QR/bank transfer methods. Bookings without verified payment within 48 hours may be released.', 3),
('House Rules', 'house-rules',
 'Quiet hours are 10:00 PM – 7:00 AM. No smoking inside rooms. Pool hours are 7:00 AM – 9:00 PM. Guests are responsible for any damages to property.', 4);
