import { getAdminToken } from './adminAuth';
import { mirrorAdminTokenForNewTab } from './islandHoppingPrintCache';

export function openBookingSoaPrint(bookingId, docType = 'soa') {
  if (!getAdminToken()) {
    window.location.href = '/admin/login';
    return;
  }

  // Allow the new tab to authenticate when token is session-scoped.
  mirrorAdminTokenForNewTab();

  const params = new URLSearchParams({ doc: docType === 'confirmation' ? 'confirmation' : 'soa' });
  const printWindow = window.open(
    `/admin/bookings/${bookingId}/print-soa?${params.toString()}`,
    '_blank',
    'noopener,noreferrer'
  );

  if (!printWindow) {
    throw new Error('Pop-up blocked. Please allow pop-ups to open the printable SOA.');
  }
}
