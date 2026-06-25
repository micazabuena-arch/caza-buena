import { getAdminToken } from './adminAuth';
import { mirrorAdminTokenForNewTab } from './islandHoppingPrintCache';

export function openBookingSoaPrint(bookingId) {
  if (!getAdminToken()) {
    window.location.href = '/admin/login';
    return;
  }

  // Allow the new tab to authenticate when token is session-scoped.
  mirrorAdminTokenForNewTab();

  const printWindow = window.open(
    `/admin/bookings/${bookingId}/print-soa`,
    '_blank',
    'noopener,noreferrer'
  );

  if (!printWindow) {
    throw new Error('Pop-up blocked. Please allow pop-ups to open the printable SOA.');
  }
}
