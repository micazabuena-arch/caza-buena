import { formatGuestCount } from './guestCount';
import { downloadExcel } from './exportExcel';
import { todayYmd } from './exportCsv';

const GUEST_EXPORT_COLUMNS = [
  { label: 'Reference', key: 'reference_code' },
  { label: 'Guest name', key: 'guest_name' },
  { label: 'Email', key: 'guest_email' },
  { label: 'Phone', key: 'guest_phone' },
  { label: 'Room', key: 'room_name' },
  { label: 'Check-in', key: 'check_in' },
  { label: 'Check-out', key: 'check_out' },
  { label: 'Nights', key: 'nights' },
  { label: 'Guests', value: (b) => formatGuestCount(b) },
  { label: 'Adults', key: 'adults' },
  { label: 'Children under 6', key: 'children_under6' },
  { label: 'Children 7-12', key: 'children_7_12' },
  { label: 'Total (PHP)', value: (b) => Number(b.total_amount || 0) },
  { label: 'Pay now (PHP)', value: (b) => Number(b.amount_to_pay ?? b.total_amount ?? 0) },
  { label: 'Status', value: (b) => String(b.status || '').replace(/_/g, ' ') },
  { label: 'Valid ID', key: 'valid_id' },
  { label: 'ETA', key: 'estimated_arrival' },
  { label: 'Island hopping', value: (b) => (b.island_hopping ? 'Yes' : 'No') },
  { label: 'Booked on', value: (b) => (b.created_at ? String(b.created_at).slice(0, 10) : '') },
];

function exportFilename(count) {
  return `caza-buena-guests-${todayYmd()}-${count}-rows.xlsx`;
}

export function exportGuestBookingsExcel(bookings) {
  const rows = [...bookings];
  if (rows.length === 0) return { ok: false, reason: 'No guest data to export.' };

  downloadExcel(exportFilename(rows.length), 'Guests', GUEST_EXPORT_COLUMNS, rows);
  return { ok: true, count: rows.length };
}
