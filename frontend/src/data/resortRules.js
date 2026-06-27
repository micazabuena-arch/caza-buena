/** Guest-facing copy for Caza Buena occupancy & pricing rules */

export const ROOM_INVENTORY = {
  suite: {
    label: 'Suite Room (2 bedrooms)',
    subtitle: 'Two-bedroom suite',
    units: ['ROOM 101', 'ROOM 201', 'ROOM 301'],
    count: 3,
    capacityNote:
      'Up to 8 adults + 2 children (below 6) + 2 children (7–12), OR 10 adults + 2 children (below 6).',
  },
  queen: {
    label: 'Queen Room (1 bedroom)',
    subtitle: 'One-bedroom room',
    units: ['ROOM 102', 'ROOM 103', 'ROOM 202', 'ROOM 203', 'ROOM 302', 'ROOM 303'],
    count: 6,
    capacityNote:
      'Up to 5 adults, OR 4 adults + 1 child (below 6), OR 4 adults + 1 child (7–12).',
  },
};

export const EXTRA_PERSON_RATES = {
  adult_weekday: 800,
  adult_weekend: 900,
  child_under_6: 0,
  child_7_12: 400,
};

/** Guest-facing bedroom count from room type */
export function bedroomCountLabel(roomType) {
  return roomType === 'suite' ? '2 bedrooms' : '1 bedroom';
}

function roomTypeSubtitle(roomType) {
  return roomType === 'suite' ? 'Two-bedroom suite' : 'One-bedroom queen';
}

/** Floor number from sort_order (e.g. 101 → 1) or room name (e.g. ROOM 201 → 2) */
export function roomFloor(room) {
  const sort = Number(room?.sort_order);
  if (Number.isFinite(sort) && sort >= 100) return Math.floor(sort / 100);
  const match = String(room?.name || '').match(/\b(\d{3})\b/);
  if (match) return Math.floor(parseInt(match[1], 10) / 100);
  return null;
}

/** Room card subtitle — fixes corrupted middle-dot (shows as ??) in stored text */
export function roomShortDescription(room) {
  const raw = String(room?.short_description || '').trim();
  const cleaned = raw
    .replace(/\u00B7/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\s*\?\?\s*/g, ' - ')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned && !/\?\?/.test(cleaned)) return cleaned;

  const type = roomTypeSubtitle(room?.room_type);
  const floor = roomFloor(room);
  return floor ? `${type} - Floor ${floor}` : type;
}

/** Short capacity line — e.g. "Up to 4 guests". */
export function roomGuestCapacityShortLabel(room) {
  const max = Number(room?.max_guests) || Number(room?.capacity);
  const min = Number(room?.min_guests) || 1;
  if (max > 0) {
    if (min > 1) return `${min}–${max} guests`;
    return `Up to ${max} guests`;
  }
  return null;
}

/** Guest-facing capacity — always mirrors Admin → Rooms min/max for that room. */
export function roomGuestCapacityLabel(room) {
  const short = roomGuestCapacityShortLabel(room);
  return short ? `${short} for this room.` : null;
}

/** Weekday starting price — e.g. "Price starts at ₱3,000 / night". */
export function roomPriceStartsAtLabel(room) {
  const price = Number(room?.price_per_night);
  if (!Number.isFinite(price) || price <= 0) return null;
  return `Price starts at ₱${price.toLocaleString()} / night`;
}

export const DISCOUNT_POLICY = [
  'Discounts cannot be combined with other promos, flash sales, early bird rates, or group discounts.',
  'If multiple discounts apply, only the single highest discount is used.',
  'All discounts are net of VAT.',
  'PWD/Senior Citizen (20%) discounts are prorated per eligible guest—not on the full booking total.',
];
