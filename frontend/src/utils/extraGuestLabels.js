import { EXTRA_PERSON_RATES } from '../data/resortRules';

/**
 * Short labels for extra guest charges in the booking price summary.
 * @returns {{ label: string, amount: number }[]}
 */
export function getExtraAdultsLines(extraBreakdown) {
  const count = extraBreakdown?.extraAdults || 0;
  if (!count) return [];

  const pax = `${count} PAX`;
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
      label: `Extra adults · ${pax} = ₱${weekdayRate.toLocaleString()}/weekday night`,
      amount: nightlyWeekday * weekdayNights,
    });
  }
  if (weekendNights > 0) {
    lines.push({
      label: `Extra adults · ${pax} = ₱${weekendRate.toLocaleString()}/weekend night`,
      amount: nightlyWeekend * weekendNights,
    });
  }

  return lines;
}

export function formatExtraChildrenLabel(extraBreakdown) {
  const count = extraBreakdown?.extraChildren7_12 || 0;
  if (!count) return '';

  const rate = extraBreakdown.childRate ?? EXTRA_PERSON_RATES.child_7_12;
  return `Children 7–12 · ${count} PAX = ₱${rate.toLocaleString()}/night`;
}
