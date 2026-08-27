import { EXTRA_PERSON_RATES } from '../data/resortRules';

/**
 * Short labels for extra guest charges in the booking price summary.
 * @returns {{ label: string, amount: number }[]}
 */
export function getExtraAdultsLines(extraBreakdown) {
  const count = extraBreakdown?.extraAdults || 0;
  if (!count) return [];

  const weekdayNights = extraBreakdown.weekdayNights || 0;
  const weekendNights = extraBreakdown.weekendNights || 0;
  const weekdayRate =
    extraBreakdown.adultWeekdayRate ?? EXTRA_PERSON_RATES.adult_weekday;
  const weekendRate =
    extraBreakdown.adultWeekendRate ?? EXTRA_PERSON_RATES.adult_weekend;
  const nightlyWeekday = extraBreakdown.nightlyAdultWeekday ?? count * weekdayRate;
  const nightlyWeekend = extraBreakdown.nightlyAdultWeekend ?? count * weekendRate;

  const lines = [];

  if (weekdayNights > 0) {
    lines.push({
      label: `Extra adults (${count}) · ₱${weekdayRate.toLocaleString()}/weekday night × ${weekdayNights}`,
      amount: nightlyWeekday * weekdayNights,
    });
  }
  if (weekendNights > 0) {
    lines.push({
      label: `Extra adults (${count}) · ₱${weekendRate.toLocaleString()}/weekend night × ${weekendNights}`,
      amount: nightlyWeekend * weekendNights,
    });
  }

  return lines;
}

export function formatExtraChildrenLabel(extraBreakdown) {
  const count = extraBreakdown?.extraChildren7_12 || 0;
  if (!count) return '';

  const rate = extraBreakdown.childRate ?? EXTRA_PERSON_RATES.child_7_12;
  const nights = (extraBreakdown.weekdayNights || 0) + (extraBreakdown.weekendNights || 0);
  const nightLabel = nights === 1 ? '1 night' : `${nights} nights`;
  return `Children 7–12 (${count}) · ₱${rate.toLocaleString()}/night × ${nightLabel}`;
}

/** Per-room extra guest charge lines for the booking price summary. */
export function getExtraGuestChargeLines(extraBreakdown, { roomName } = {}) {
  if (!extraBreakdown) return [];

  const chargeTotal =
    Number(extraBreakdown.total) ||
    Number(extraBreakdown.adultChargeTotal || 0) + Number(extraBreakdown.childChargeTotal || 0);
  if (chargeTotal <= 0) return [];

  const prefix = roomName ? `${roomName} · ` : '';
  const lines = getExtraAdultsLines(extraBreakdown).map(({ label, amount }) => ({
    label: `${prefix}${label}`,
    amount,
  }));

  const childCount = extraBreakdown.extraChildren7_12 || 0;
  if (childCount > 0) {
    const nights = (extraBreakdown.weekdayNights || 0) + (extraBreakdown.weekendNights || 0);
    const amount =
      Number(extraBreakdown.childChargeTotal) ||
      (extraBreakdown.nightlyChild || 0) * nights;
    if (amount > 0) {
      lines.push({
        label: `${prefix}${formatExtraChildrenLabel(extraBreakdown)}`,
        amount,
      });
    }
  }

  return lines;
}

/** Combined extra guest lines across all booked rooms. */
export function collectBookingExtraChargeLines(roomLines, lineQuotes, rooms) {
  const lines = [];
  for (const line of roomLines) {
    if (!line.room_id) continue;
    const quote = lineQuotes[line.id];
    const chargeTotal = Number(quote?.extra_person_charges) || 0;
    if (chargeTotal <= 0) continue;

    const room = rooms.find((r) => String(r.id) === String(line.room_id));
    lines.push(
      ...getExtraGuestChargeLines(quote?.extra_breakdown, { roomName: room?.name })
    );
  }
  return lines;
}

/**
 * Room line amount for price summaries.
 * Extra adults/children within the stay are folded into the room total
 * (not shown as a separate "Extra guest charges" block).
 */
export function quoteRoomDisplayAmount(quote) {
  return Number(quote?.subtotal || quote?.room_subtotal || 0);
}
