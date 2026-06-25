/**
 * Static page placeholder content for Caza Buena.
 * Replace images and copy with final resort assets when ready.
 */

export const resort = {
  name: 'Caza Buena',
  tagline: 'Your home after the sea',
  location: 'Sitio Inansuana, Brgy. Lucap, Alaminos, Pangasinan',
  mapCenter: { lat: 16.1765, lng: 119.9818 },
  mapsUrl:
    'https://www.google.com/maps/place/caza+buena/data=!4m2!3m1!1s0x3393dbb9fa291cb5:0x6b79381bed3987ce',
  // Lucap, Alaminos — zoom 17 so the embed shows Caza Buena area, not a world map
  mapsEmbedUrl:
    'https://maps.google.com/maps?q=Caza+Buena,+Sitio+Inansuana,+Lucap,+Alaminos,+Pangasinan&hl=en&z=17&output=embed',
  phone: '0947 191 8080',
  phoneTel: '+639471918080',
  email: 'mi.caza.buena@gmail.com',
  instagram: 'https://www.instagram.com/cazabuena_',
  facebook: 'https://www.facebook.com/profile.php?id=61557575977651',
  tiktok: 'https://www.tiktok.com/@caza.buena',
  checkIn: '1:00 PM',
  checkOut: '11:00 AM',
  dotAccredited: 'DEPARTMENT OF TOURISM (DOT) Accredited',
};

/** Default hero images (Unsplash — swap for resort photos) */
export const images = {
  /** Inner pages (not home) — Santorini resort hero */
  pageHero: '/hero.jpg',
  /** Keeps the Caza Buena wall logo in frame (right wall, ~46% from top) */
  pageHeroObjectPosition: '88% 50%',
  hero: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1920',
  about: '/about.jpg',
  cta: '/last.jpg',
  rooms: 'https://images.unsplash.com/photo-1611892440504-42a784e83da7?w=1200',
  amenities: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200',
  gallery: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200',
  contact: 'https://images.unsplash.com/photo-1582719508461-905c59372395?w=1200',
  booking: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200',
  faq: 'https://images.unsplash.com/photo-1582719508461-905c59372395?w=1200',
  policies: 'https://images.unsplash.com/photo-1611892440504-42a784e83da7?w=1200',
  meals: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200',
  /** Swap each item’s `image` in pages.meals.items with `/meals/your-photo.jpg` when ready */
  mealItem: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  room: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
};

export const pages = {
  cta: {
    title: 'Your Island Getaway Starts Here',
    text:
      'Reserve your stay at Caza Buena—minutes from Lucap Wharf and the Hundred Islands. Browse our rooms and find the perfect space for your trip.',
    button: 'Book Your Stay',
    link: '/rooms',
  },
  home: {
    eyebrow: 'Alaminos · Pangasinan',
    title: 'Caza Buena',
    subtitle: 'Book the Santorini vibe—no passport needed.',
    highlights: [
      { title: 'Mediterranean Escape', desc: 'Whitewashed walls and ocean-blue accents inspired by Santorini.' },
      { title: 'Hundred Islands Gateway', desc: 'Minutes from Lucap Wharf—your jump-off to island adventures.' },
      { title: 'DOT Accredited', desc: 'Department of Tourism accredited hostel, café & hospitality.' },
    ],
    testimonials: [
      {
        author: 'Janus',
        rating: 5,
        quote:
          'Highly recommend and will come back for sure! The staff are friendly and accommodating, we all enjoyed the free snacks. The villa is clean and spacious for a group of 7. The kids surely enjoyed the jacuzzi pool. 7 minutes walk to the tourist area. Overall good experience. 5 stars!',
      },
      {
        author: 'Jam',
        rating: 5,
        quote:
          'We had a wonderful overnight stay at Caza Buena with our group of 8. The rooms were spacious, clean, and very comfortable for everyone. The staff were incredibly accommodating, especially Ms. May, who made our stay even more memorable with her kindness and hospitality. They also have a café with great food options and a free snack bar, which we really appreciated. My nephew enjoyed the snacks so much, and Ms. May even kindly let him bring some as baon for our trip home — such a thoughtful gesture. The location is also excellent since it’s near the beach. Overall, one of the best accommodations in the area, and we would definitely love to come back.',
      },
      {
        author: 'Jmar',
        rating: 5,
        quote:
          'We had a fantastic experience at this hotel. From the moment we arrived, the staff were incredibly friendly, welcoming, and professional. They went above and beyond to make sure we were comfortable throughout our stay. One thing we truly appreciated was that they allowed us to check in early, which made a huge difference after a long trip. The process was smooth and hassle-free. The room was clean, cozy, and well-maintained, providing everything we needed for a relaxing stay. Housekeeping did a great job, and the overall atmosphere of the hotel was warm and inviting. Exceptional service and genuinely kind staff made our stay memorable. We would definitely come back and highly recommend this hotel to anyone looking for comfort and outstanding hospitality!',
      },
    ],
  },
  about: {
    eyebrow: 'Our Story',
    title: 'About Caza Buena',
    subtitle: 'Where Greek island charm meets warm Filipino hospitality.',
    contentTitle: 'Welcome to Caza Buena',
    paragraphs: [
      'Born in 2024, our unique Airbnb-hostel hybrid brings the timeless, sun-drenched beauty of Santorini right to Alaminos, Pangasinan—where Greek island charm meets warm Filipino hospitality and the perfect blend of a social community vibe and a cozy, comfortable stay.',
      'Located just a 7-minute walk from Lucap Wharf, the official gateway to the world-famous Hundred Islands National Park, Caza Buena places you close to every island adventure. Guests consistently rave about our striking Santorini-inspired aesthetic, cozy atmosphere, and heartfelt service.',
      'Our family-run property is proudly managed by owners Ms. May and Sir Carlos, ensuring every guest feels personally cared for. To fuel your day, our in-house cafe serves fresh coffee and delicious breakfast choices every morning. At Caza Buena, you are not just booking a bed — you are stepping into a beautiful haven where island dreams come to life and every guest is welcomed like old friends.',
    ],
    values: [
      { label: 'Hospitality', text: 'Warm, personal service for every guest.' },
      { label: 'Design', text: 'Santorini-inspired spaces made for relaxation and photos.' },
      { label: 'Location', text: 'Steps away from Lucap and the Hundred Islands.' },
    ],
  },
  rooms: {
    eyebrow: 'Accommodations',
    title: 'Rooms & Suites',
    subtitle: 'Two-bedroom suites and one-bedroom queen rooms—Mediterranean-inspired spaces for every traveler.',
  },
  amenities: {
    eyebrow: 'Experience',
    title: 'Resort Amenities',
    subtitle: 'Experience only at Caza Buena.',
    items: [
      { icon: 'Building2', title: 'Santorini-Inspired Architecture', description: 'Beautiful, photogenic white-and-blue aesthetic throughout the property.' },
      { icon: 'Waves', title: 'Private Mini Plunge Pool (Suite Room)', description: 'Exclusive to the Suite Room—a private spot to unwind and refresh.' },
      { icon: 'Projector', title: 'Smart Projector', description: 'Enjoy a cinematic movie night right in your room or living area.' },
      { icon: 'Coffee', title: 'In-House Cafe', description: 'Serving fresh coffee and delicious breakfast options daily to fuel your adventures.' },
      { icon: 'Candy', title: 'Complimentary Snack Bar', description: 'Free for all guests—perfect for post-island-hopping cravings.' },
      { icon: 'Mic2', title: 'Karaoke', description: 'Sing your heart out with friends and family—a true Filipino vacation essential.' },
      { icon: 'CookingPot', title: 'Free Use of Common Kitchen', description: 'Fully equipped for guests who prefer to cook meals or prep fresh market seafood.' },
      { icon: 'BedDouble', title: 'Premium Sleep Comfort', description: 'Premium 6-inch mattresses, crisp white linens and flatsheets, fluffy pillows, and flexible bedding setups (queen beds, daybeds, and pull-out beds).' },
      { icon: 'Wind', title: 'Full Air-Conditioning', description: 'All rooms are fully air-conditioned for a cool and comfortable stay.' },
      { icon: 'ShowerHead', title: 'Bathroom Essentials', description: 'Heated shower, fresh clean towels, body wash, and shower gel. Additional guest kits are available upon request.' },
      { icon: 'Utensils', title: 'Mini Kitchenette (Suite Room Only)', description: 'Includes a microwave, buddy refrigerator, kitchen sink, and plates for convenient in-suite dining.' },
      { icon: 'Wifi', title: 'Fast Wi-Fi', description: 'High-speed internet ideal for streaming, work, and staying connected.' },
      { icon: 'MapPin', title: 'Prime Location', description: 'Just a 7-minute walk to Lucap Wharf, your gateway to the Hundred Islands.' },
    ],
  },
  gallery: {
    eyebrow: 'Visual Journey',
    title: 'Gallery',
    subtitle: 'Whitewashed walkways, poolside sunsets, and island-day moments.',
    items: [
      { title: 'Santorini Terrace', category: 'exterior' },
      { title: 'Pool at Dusk', category: 'amenities' },
      { title: 'Aegean Breakfast', category: 'dining' },
      { title: 'Whitewashed Walkway', category: 'exterior' },
      { title: 'Ocean View Lounge', category: 'interior' },
      { title: 'Sunset by the Sea', category: 'exterior' },
    ],
  },
  faq: {
    eyebrow: 'Help Center',
    title: 'Frequently Asked Questions',
    subtitle: 'Everything you need before your stay.',
    items: [
      {
        question: 'What are check-in and check-out times?',
        answer:
          'Check-in is at 1:00 PM and check-out is at 11:00 AM. Early check-in may be arranged subject to availability.',
      },
      {
        question: 'How do I pay for my booking?',
        answer:
          'We accept QR payments via GCash, Maya, and bank transfer (BDO/BPI). After submitting your booking request, you will receive payment instructions and can upload proof of payment on our website.',
      },
      {
        question: 'When is my booking confirmed?',
        answer:
          'Your booking is confirmed once our team verifies your payment. You will receive a confirmation email.',
      },
      {
        question: 'Is Caza Buena DOT accredited?',
        answer: 'Yes. Caza Buena is accredited by the Department of Tourism (DOT).',
      },
      {
        question: 'Where is Caza Buena located?',
        answer: `We are located at Inansuana St., Barangay Lucap, Alaminos, Pangasinan.

• 7-minute walk from Lucap Wharf
• 2-minute drive from Lucap Wharf

Nearest landmark: Sitio Inansuana Basketball Court`,
      },
      {
        question: 'Are you beachfront?',
        answer: `We are not beachfront. We are a 7-minute walk to and from the Hundred Islands Wharf/port. The Hundred Islands is the nearest beach experience from Caza Buena.

If you want to visit beaches near us without riding a boat, we suggest Bolo Beach or Masamirey Beach.`,
      },
      {
        question: 'What islands should we visit during island hopping?',
        answer: `Top islands to visit during your island hopping:

Pilgrimage Island
• Statue of Christ the Savior
• Sightseeing & photos
• Quiet reflection

Governor's Island
• View deck (best panoramic photo spot)
• Short hike
• Swimming

Quezon Island
• Beach swimming
• Water activities and zipline
• Kayaking or banana boat (if available)

Marcos Island
• Cave exploration (Imelda Cave)
• Cliff jumping
• Swimming

Children's Island
• Fine sand beach
• Relaxing swim
• Great for photos

Scout Island (or Coral Garden area)
• Snorkeling
• Fish feeding
• Clear shallow waters

These are just some of the 100+ islands we suggest—there is much more to see!`,
      },
      {
        question: 'How does the island hopping tour work?',
        answer: `Hundred Islands Tour Coordination

If you would like us to assist you in arranging your Hundred Islands tour, please review the information below.

Please note that we do not own or operate the boat tours. The Hundred Islands National Park tours are exclusively managed and offered by the Local Department of Tourism.

Registration & Timing: The tourism office opens at 6:00 AM for registration (registration time is from 7:00 AM until 3:00 PM). We highly recommend starting your island-hopping adventure around 7:00 AM.

At the Wharf: Upon arrival, you will meet the tour facilitator who will assist you to your assigned boat.

Your Itinerary: Your boatman has a standard itinerary guide to follow. However, since your group is renting a private boat, you are welcome to suggest specific islands you would like to visit or spend more time on.

Schedule Flexibility: The tour schedule is highly flexible. You can head out anytime between 7:00 AM and 3:00 PM, and you may return to the wharf whenever you are ready, provided it is no later than 5:00 PM.`,
      },
    ],
  },
  policies: {
    eyebrow: 'Guest Information',
    title: 'Resort Policies',
    subtitle: 'Please review before booking your stay.',
    items: [
      { title: 'Maximum Guests per Room', content: 'Suite: up to 8 adults + 2 children (below 6) + 2 children (7–12), OR 10 adults + 2 children (below 6). Queen: up to 5 adults, OR 4 adults + 1 child (below 6), OR 4 adults + 1 child (7–12). Room rates cover all guests within these limits.' },
      { title: 'Extra Person Charges', content: 'Extra adult: ₱800 per night. Children 6 years old and below: free. Children 7–12 years old: ₱400 per night. Fees apply only for guests beyond the base package: Suite includes up to 8 adults + 2 children (below 6) + 2 children (7–12); Queen includes 2 adults (additional adults and children are charged per policy).' },
      { title: 'Peak Season Rates', content: 'Peak season rates will be announced. Holiday and special-date pricing may apply when published in our booking calendar.' },
      { title: 'Discount Policy', content: 'Discounts cannot be stacked with other promos, flash sales, early bird rates, or group discounts. If multiple discounts apply, only the highest eligible discount is used. All discounts are net of VAT. PWD/Senior Citizen (20%) discounts are prorated per eligible guest—the discount applies only to that guest’s share of the rate, not the entire booking total.' },
      { title: 'Reservation & Confirmation', content: 'Once your downpayment is made, our booking staff will verify that payment is reflected on our end. After verification, a booking confirmation will be sent to your email. A reservation request alone does not guarantee a room until payment is verified.' },
      { title: 'Cancellation Policy', content: 'Cancellations made 7 days before check-in receive a full refund of verified payments. Cancellations within 7 days may incur a 50% charge. No-shows are non-refundable.' },
      { title: 'House Rules', content: 'Quiet hours are 10:00 PM – 7:00 AM. No smoking inside rooms. Pool hours are 7:00 AM – 9:00 PM. Guests are responsible for any damages to property.' },
    ],
  },
  contact: {
    eyebrow: 'Get in Touch',
    title: 'Contact Us',
    subtitle: 'Questions about your stay or the Hundred Islands? We are here to help.',
    introTitle: 'We Would Love to Hear From You',
    introText:
      'Reach out for room availability, island hopping, group bookings, or anything about your stay at Caza Buena. Fill out the form and our team will get back to you as soon as we can—or call, email, or visit us in Lucap.',
    hours: [
      { day: 'Front Desk', time: '8:00 AM – 9:00 PM' },
      { day: 'Café', time: '7:00 AM – 8:00 PM' },
      { day: 'Check-in', time: resort.checkIn },
      { day: 'Check-out', time: resort.checkOut },
    ],
  },
  booking: {
    eyebrow: 'Reservations',
    title: 'Book Your Stay',
    subtitle: 'Submit your reservation with guest details and valid ID. Pay the downpayment via QR—our team will confirm once payment is verified.',
  },
  meals: {
    eyebrow: 'Café & Dining',
    title: 'Meals & Menu',
    subtitle: 'All-day breakfast, rice meals, sides, pasta, and drinks at Caza Buena.',
    intro:
      'Start the day with Filipino breakfast favorites, grab a rice meal after island hopping, or unwind with pasta, fries, and café drinks.',
    hoursNote: 'Café hours: 7:00 AM – 8:00 PM daily. Menu items and prices may change seasonally.',
    pdfUrl: '/menu.pdf',
    pdfNote: 'Opens the full café menu PDF in a new tab.',
    disclaimer:
      'Menu is for reference only. Dine-in at the café; online meal ordering is not available on this website.',
    items: [
      {
        category: 'All Day Breakfast',
        name: 'Beef Tapa',
        price: 120,
        image: '/meals/beef-tapa.jpg',
      },
      {
        category: 'All Day Breakfast',
        name: 'Longganisa',
        price: 110,
        image: '/meals/longganisa.jpg',
      },
      {
        category: 'All Day Breakfast',
        name: 'Tocino',
        price: 110,
        image: '/meals/tocino.jpg',
      },
      {
        category: 'All Day Breakfast',
        name: 'Hotdog',
        price: 95,
        image: '/meals/hotdog.jpg',
      },
      {
        category: 'All Day Breakfast',
        name: 'Danggit',
        price: 130,
        image: '/meals/danggit.jpg',
      },
      {
        category: 'Rice Meals',
        name: 'Beef Tapa Rice Meal',
        price: 150,
        image: '/meals/beef-tapa-rice.jpg',
      },
      {
        category: 'Rice Meals',
        name: 'Longganisa Rice Meal',
        price: 140,
        image: '/meals/longganisa-rice.jpg',
      },
      {
        category: 'Rice Meals',
        name: 'Tocino Rice Meal',
        price: 140,
        image: '/meals/tocino-rice.jpg',
      },
      {
        category: 'Snacks & Extras',
        name: 'Potato Wedge',
        price: 80,
        image: '/meals/potato-wedge.jpg',
      },
      {
        category: 'Snacks & Extras',
        name: 'Fries',
        price: 70,
        image: '/meals/fries.jpg',
      },
      {
        category: 'Snacks & Extras',
        name: 'Pasta',
        price: 160,
        image: '/meals/pasta.jpg',
      },
      {
        category: 'Drinks',
        name: 'Hot Coffee',
        price: 50,
        image: '/meals/hot-coffee.jpg',
      },
      {
        category: 'Drinks',
        name: 'Iced Coffee',
        price: 65,
        image: '/meals/iced-coffee.jpg',
      },
      {
        category: 'Drinks',
        name: 'Soft Drink',
        price: 45,
        image: '/meals/soft-drink.jpg',
      },
      {
        category: 'Drinks',
        name: 'Juice',
        price: 55,
        image: '/meals/juice.jpg',
      },
    ],
  },
};

/** Placeholder room cards when API is empty or loading */
export const placeholderRooms = [
  {
    id: 'ph-1',
    slug: 'aegean-suite',
    name: 'Aegean Suite',
    room_type: 'suite',
    short_description: 'Two-bedroom suite with Santorini-inspired interiors.',
    capacity: 4,
    price_per_night: 4500,
    images: [{ image_url: images.room }],
  },
  {
    id: 'ph-2',
    slug: 'cyclades-room',
    name: 'Cyclades Room',
    room_type: 'queen',
    short_description: 'One-bedroom queen room with Mediterranean charm.',
    capacity: 2,
    price_per_night: 3200,
    images: [{ image_url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800' }],
  },
  {
    id: 'ph-3',
    slug: 'lucap-dorm-pod',
    name: 'Lucap Dorm Pod',
    short_description: 'Pod-style beds for groups and solo travelers.',
    capacity: 6,
    price_per_night: 850,
    images: [{ image_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800' }],
  },
];

/** Gallery grid placeholder slots */
export const galleryPlaceholders = [
  images.hero,
  images.amenities,
  images.about,
  images.room,
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800',
  'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800',
];
