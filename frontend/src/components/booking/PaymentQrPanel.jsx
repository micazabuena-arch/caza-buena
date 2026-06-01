import { QrCode } from 'lucide-react';
import { getAssetUrl } from '../../utils/assetUrl';
import { PAYMENT_METHOD_LABELS } from './PaymentWorkflowSteps';

/**
 * Shows QR code and payment details for the selected method (GCash, Maya, etc.)
 */
export default function PaymentQrPanel({ method, reference, amountDue }) {
  if (!method) return null;

  const label = PAYMENT_METHOD_LABELS[method.type] || method.name;

  return (
    <div className="rounded-xl border border-aegean-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2 text-aegean-800">
        <QrCode size={20} />
        <h4 className="font-medium">{label}</h4>
      </div>

      {amountDue != null && (
        <p className="text-sm text-aegean-700">
          Amount to pay: <strong className="text-lg text-aegean-500">₱{Number(amountDue).toLocaleString()}</strong>
        </p>
      )}

      {method.qr_image_url ? (
        <div className="text-center">
          <img
            src={getAssetUrl(method.qr_image_url)}
            alt={`${label} QR code`}
            className="mx-auto max-w-[240px] w-full rounded-xl shadow-md border border-aegean-100"
          />
          <p className="text-xs text-aegean-500 mt-2">Scan this QR code to pay</p>
        </div>
      ) : (
        <div className="rounded-lg bg-aegean-50 p-4 text-sm text-aegean-700 text-center">
          <p className="font-medium text-aegean-800 mb-1">QR code not uploaded yet</p>
          {method.account_name && <p>Account name: {method.account_name}</p>}
          {method.account_number && <p>Account / number: {method.account_number}</p>}
          <p className="text-xs text-aegean-500 mt-2">Admin can upload the QR in Admin → Payments</p>
        </div>
      )}

      {reference && (
        <p className="text-sm text-center text-aegean-800 bg-aegean-50 rounded-lg py-2 px-3">
          Use booking reference <strong className="font-mono">{reference}</strong> in the payment notes
        </p>
      )}

      {method.instructions && (
        <p className="text-sm text-aegean-600 border-t border-aegean-100 pt-3">{method.instructions}</p>
      )}
    </div>
  );
}
