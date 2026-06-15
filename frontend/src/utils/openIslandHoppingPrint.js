import api, { getApiError } from '../api/client';
import { parseIslandHoppingData } from '../data/islandHoppingRates';
import { getAdminToken } from './adminAuth';
import {
  mirrorAdminTokenForNewTab,
  storeIslandHoppingPrintCache,
  clearIslandHoppingPrintCache,
} from './islandHoppingPrintCache';

/**
 * Fetch manifest data in this tab (authenticated), cache it, then open print view.
 * The print tab reads the cache so it does not depend on cross-tab sessionStorage.
 */
export async function openIslandHoppingPrint(bookingId) {
  if (!getAdminToken()) {
    window.location.href = '/admin/login';
    return;
  }

  const { data: booking } = await api.get(`/bookings/admin/${bookingId}`);
  const islandHop = booking?.island_hopping
    ? parseIslandHoppingData(booking.island_hopping_data)
    : null;

  if (!islandHop) {
    throw new Error('This booking does not include island hopping.');
  }

  storeIslandHoppingPrintCache(bookingId, booking, islandHop);
  mirrorAdminTokenForNewTab();

  const printWindow = window.open(
    `/admin/bookings/${bookingId}/print-island`,
    '_blank',
    'noopener,noreferrer'
  );

  if (!printWindow) {
    clearIslandHoppingPrintCache();
    throw new Error('Pop-up blocked. Allow pop-ups for this site to print the manifest.');
  }
}

export function getOpenIslandHoppingPrintError(err) {
  return getApiError(err);
}
