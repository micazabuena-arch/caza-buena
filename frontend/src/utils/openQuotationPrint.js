import { getAdminToken } from './adminAuth';
import { mirrorAdminTokenForNewTab } from './islandHoppingPrintCache';
import { storeQuotationPrintCache } from './quotationPrintCache';

const PRINT_PATH = '/admin/quotation/print';

export function openQuotationPrint(quote) {
  if (!getAdminToken()) {
    window.location.href = '/admin/login';
    return;
  }

  storeQuotationPrintCache(quote);
  mirrorAdminTokenForNewTab();

  const printWindow = window.open(PRINT_PATH, '_blank');

  // If the browser blocks pop-ups, open in this tab instead.
  if (!printWindow) {
    window.location.assign(PRINT_PATH);
  }
}
