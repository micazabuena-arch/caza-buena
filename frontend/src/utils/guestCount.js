export function getTotalGuests(booking) {
  if (booking?.guest_count != null && booking.guest_count !== '') {
    const n = Number(booking.guest_count);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return (
    (Number(booking?.adults) || 0) +
    (Number(booking?.children_under6) || 0) +
    (Number(booking?.children_7_12) || 0)
  );
}

export function formatGuestCount(booking) {
  const total = getTotalGuests(booking);
  const adults = Number(booking?.adults) || 0;
  const under6 = Number(booking?.children_under6) || 0;
  const seven12 = Number(booking?.children_7_12) || 0;

  const label = `${total} guest${total !== 1 ? 's' : ''}`;
  const parts = [];
  if (adults > 0) parts.push(`${adults} adult${adults !== 1 ? 's' : ''}`);
  if (under6 > 0) parts.push(`${under6} under 6`);
  if (seven12 > 0) parts.push(`${seven12} age 7–12`);

  if (parts.length > 0 && adults + under6 + seven12 === total) {
    return `${label} (${parts.join(', ')})`;
  }
  return label;
}
