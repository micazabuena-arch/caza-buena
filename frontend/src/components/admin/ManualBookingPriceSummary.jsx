import FoodAddOnsOrderSummary from '../booking/FoodAddOnsOrderSummary';
import {
  collectBookingExtraChargeLines,
  quoteRoomDisplayAmount,
} from '../../utils/extraGuestLabels';

const rowClass = 'flex justify-between gap-4 text-sm text-aegean-700';

/**
 * Itemized price summary for admin manual booking (payment step).
 */
export default function ManualBookingPriceSummary({
  roomLines,
  lineQuotes,
  rooms,
  nights,
  roomSubtotal,
  manualDiscount = 0,
  discountNote = '',
  islandTotal = 0,
  islandHoppingEnabled = false,
  extrasQuote,
  bookingExtras,
  totalAmount,
}) {
  const bookedLines = roomLines.filter((line) => line.room_id);
  const extraChargeLines = collectBookingExtraChargeLines(roomLines, lineQuotes, rooms);
  const foodTotal = extrasQuote?.valid
    ? (extrasQuote.bilao_amount || 0) + (extrasQuote.boodle_fight_amount || 0)
    : 0;

  if (roomSubtotal <= 0 && islandTotal <= 0 && foodTotal <= 0) return null;

  return (
    <div className="rounded-lg border border-aegean-100 bg-aegean-50/40 p-4 space-y-3">
      <p className="text-sm font-medium text-aegean-800">Booking breakdown</p>

      {bookedLines.length > 0 && (
        <div className="space-y-1.5">
          {bookedLines.map((line) => {
            const room = rooms.find((r) => String(r.id) === String(line.room_id));
            const quote = lineQuotes[line.id];
            const lineNights = quote?.nights || nights;
            return (
              <div key={line.id} className={rowClass}>
                <span>
                  {room?.name || 'Room'} ({lineNights} night{lineNights !== 1 ? 's' : ''})
                </span>
                <span className="shrink-0">₱{quoteRoomDisplayAmount(quote).toLocaleString()}</span>
              </div>
            );
          })}

          {extraChargeLines.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-aegean-100">
              <p className="text-xs font-medium text-aegean-600">Extra guest charges</p>
              {extraChargeLines.map((item, idx) => (
                <div
                  key={`${item.label}-${idx}`}
                  className="flex justify-between gap-4 text-xs text-aegean-600"
                >
                  <span className="min-w-0">{item.label}</span>
                  <span className="shrink-0">₱{Number(item.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className={`${rowClass} font-medium pt-1 border-t border-aegean-100`}>
            <span>{bookedLines.length > 1 ? 'Room stay subtotal' : 'Room stay'}</span>
            <span>₱{roomSubtotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      {manualDiscount > 0 && (
        <div className={`${rowClass} text-green-700`}>
          <span>{discountNote?.trim() ? `Discount (${discountNote.trim()})` : 'Special discount'}</span>
          <span>−₱{manualDiscount.toLocaleString()}</span>
        </div>
      )}

      {islandHoppingEnabled && islandTotal > 0 && (
        <div className={rowClass}>
          <span>Island hopping</span>
          <span>₱{islandTotal.toLocaleString()}</span>
        </div>
      )}

      {foodTotal > 0 && (
        <div className="border-t border-aegean-100 pt-2 space-y-1.5">
          <p className="text-sm font-medium text-aegean-800">Food add-ons</p>
          <FoodAddOnsOrderSummary
            extrasQuote={extrasQuote}
            bookingExtras={bookingExtras}
            compact
          />
          <div className="flex justify-between text-sm font-medium text-aegean-700">
            <span>Food subtotal</span>
            <span>₱{foodTotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className={`${rowClass} font-semibold text-aegean-900 pt-2 border-t border-aegean-200`}>
        <span>Booking total</span>
        <span>₱{totalAmount.toLocaleString()}</span>
      </div>
    </div>
  );
}
