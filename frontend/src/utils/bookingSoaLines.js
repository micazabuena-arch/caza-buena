import { parseStayAddons, stayAddonsTotal } from './stayAddons.js';

/** Room stay total (excludes island hopping, food add-ons, and during-stay charges). */
export function bookingRoomStayTotal(booking) {
  if (!booking) return 0;
  return (
    Number(booking.total_amount) -
    Number(booking.island_hopping_amount || 0) -
    Number(booking.bilao_amount || 0) -
    Number(booking.boodle_fight_amount || 0) -
    stayAddonsTotal(booking.stay_addons)
  );
}

/** Line items for the SOA charges table. */
export function buildBookingSoaLineItems(booking) {
  if (!booking) return [];

  const lines = [];
  const discount = Number(booking.discount_amount) || 0;
  const roomLines = Array.isArray(booking.room_lines) ? booking.room_lines : [];

  if (roomLines.length > 0) {
    for (const line of roomLines) {
      if (Number(line.subtotal) > 0) {
        lines.push({
          label: line.room_name || 'Room',
          amount: Number(line.subtotal),
        });
      }
    }
  } else {
    const roomNet = bookingRoomStayTotal(booking);
    const roomGross = roomNet + discount;
    if (roomGross > 0) {
      lines.push({ label: 'Room', amount: roomGross });
    }
  }

  if (discount > 0) {
    const discountLabel = booking.discount_code
      ? `Discount (${booking.discount_code})`
      : booking.discount_note
        ? `Discount (${booking.discount_note})`
        : 'Discount';
    lines.push({ label: discountLabel, amount: -discount });
  }
  if (booking.island_hopping && Number(booking.island_hopping_amount) > 0) {
    lines.push({
      label: 'Hundred Island tour',
      amount: Number(booking.island_hopping_amount),
    });
  }
  if (Number(booking.bilao_amount) > 0) {
    lines.push({ label: 'Seafood Bilao', amount: Number(booking.bilao_amount) });
  }
  if (Number(booking.boodle_fight_amount) > 0) {
    lines.push({
      label: 'Boodle fight',
      amount: Number(booking.boodle_fight_amount),
    });
  }

  const customAddons = Array.isArray(booking.addons) ? booking.addons : [];
  for (const addon of customAddons) {
    const showInSoa = Boolean(addon.include_in_soa ?? addon.show_in_soa ?? true);
    if (showInSoa && Number(addon.amount) > 0) {
      lines.push({
        label: addon.label || 'Add-on',
        amount: Number(addon.amount),
      });
    }
  }

  for (const addon of parseStayAddons(booking.stay_addons)) {
    lines.push({ label: addon.description, amount: addon.amount });
  }

  return lines;
}

/** Format amounts like the resort SOA sample (commas, decimals only when needed). */
export function formatSoaAmount(value) {
  const num = Number(value) || 0;
  const rounded = Math.round(num * 100) / 100;
  if (Number.isInteger(rounded)) {
    return rounded.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return rounded.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
