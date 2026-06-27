import { roomPriceStartsAtLabel } from '../../data/resortRules';

/** Guest-facing starting price from Admin → Rooms weekday rate. */
export default function RoomCapacityPricingNote({ room, size = 'default', className = '' }) {
  if (!room) return null;

  const priceLine = roomPriceStartsAtLabel(room);
  if (!priceLine) return null;

  const isCompact = size === 'compact';
  const isHero = size === 'hero';
  const priceClass = isCompact
    ? 'text-aegean-600 font-medium'
    : isHero
      ? 'text-3xl font-serif text-aegean-700'
      : 'text-sm text-aegean-700';

  return <p className={`${priceClass} ${className}`.trim()}>{priceLine}</p>;
}
