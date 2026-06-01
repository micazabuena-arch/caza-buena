-- Run once on an existing database to refresh FAQ content (e.g. mysql -u root caza_buena < faq-update.sql)

DELETE FROM faqs;

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
