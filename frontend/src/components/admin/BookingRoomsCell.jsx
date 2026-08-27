import {
  formatBookingRoomsCompact,
  isBookingStayInHouse,
  isBookingStayPast,
} from '../../utils/bookingListDisplay';

/** Compact multi-room cell for admin booking tables. */
export default function BookingRoomsCell({ booking, className = '' }) {
  const rooms = formatBookingRoomsCompact(booking);

  if (rooms.count <= 1) {
    return <span className={className}>{rooms.summary}</span>;
  }

  return (
    <div className={`min-w-0 max-w-[14rem] ${className}`.trim()} title={rooms.full}>
      <p className="text-sm font-medium text-aegean-800">{rooms.summary}</p>
      <p className="text-xs text-aegean-500 truncate">{rooms.detail}</p>
    </div>
  );
}

/** Status pill + optional Past stay / In-house hint for finished or current stays. */
export function BookingStatusBadges({ booking, statusColors, formatStatus }) {
  const past = isBookingStayPast(booking);
  const inHouse = booking?.status === 'confirmed' && isBookingStayInHouse(booking);

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
          statusColors[booking.status] || 'bg-gray-100 text-gray-700'
        }`}
      >
        {formatStatus(booking.status)}
      </span>
      {booking.status === 'confirmed' && past && (
        <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
          Past stay
        </span>
      )}
      {booking.status === 'confirmed' && inHouse && (
        <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 whitespace-nowrap">
          In house
        </span>
      )}
    </div>
  );
}
