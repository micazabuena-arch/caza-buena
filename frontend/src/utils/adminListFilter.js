/** Shared list filtering for admin pages (search, dates, status). */

export function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase();
}

export function toDateKey(value) {
  return String(value || '').slice(0, 10);
}

export function getStayCheckIn(item) {
  return toDateKey(item?.check_in);
}

export const STAY_SEARCH_FIELDS = [
  'reference_code',
  'guest_name',
  'guest_email',
  'guest_phone',
  'room_name',
  'room_names',
];

export function itemSearchText(item, fields) {
  return (fields || [])
    .map((field) => {
      if (typeof field === 'function') return field(item) || '';
      return item?.[field] ?? '';
    })
    .join(' ')
    .toLowerCase();
}

export function matchesDateRange(dateStr, dateFrom, dateTo) {
  const d = toDateKey(dateStr);
  if (!d) return !dateFrom && !dateTo;
  if (dateFrom && d < dateFrom) return false;
  if (dateTo && d > dateTo) return false;
  return true;
}

export function filterAdminList(
  items,
  {
    search = '',
    searchFields = [],
    dateFrom = '',
    dateTo = '',
    getDate,
    status = '',
    matchStatus,
    extraFilter,
  } = {}
) {
  const q = normalizeSearch(search);
  return (items || []).filter((item) => {
    if (extraFilter && !extraFilter(item)) return false;
    if (status) {
      const ok = matchStatus ? matchStatus(item, status) : String(item.status || '') === status;
      if (!ok) return false;
    }
    if (getDate && (dateFrom || dateTo) && !matchesDateRange(getDate(item), dateFrom, dateTo)) {
      return false;
    }
    if (q && !itemSearchText(item, searchFields).includes(q)) return false;
    return true;
  });
}

export const BOOKING_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'payment_submitted', label: 'Payment submitted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const ACTIVE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export const INQUIRY_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

export function matchActiveStatus(item, status) {
  const active = Boolean(Number(item?.is_active));
  return status === 'active' ? active : !active;
}

export function matchInquiryReadStatus(item, status) {
  const read = Boolean(Number(item?.is_read));
  return status === 'read' ? read : !read;
}
