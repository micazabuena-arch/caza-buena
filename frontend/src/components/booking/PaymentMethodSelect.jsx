import PaymentQrPanel from './PaymentQrPanel';
import { PAYMENT_METHOD_LABELS } from './PaymentWorkflowSteps';

export default function PaymentMethodSelect({
  methods,
  value,
  onChange,
  reference,
  amountDue,
  required = false,
}) {
  const selected = methods.find((p) => String(p.id) === String(value));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-aegean-700 mb-2">
          Preferred payment method{required ? ' *' : ''}
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          {methods.map((method) => {
            const active = String(method.id) === String(value);
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onChange(String(method.id))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  active ? 'border-aegean-500 bg-aegean-50 ring-1 ring-aegean-500/30' : 'border-aegean-100 bg-white hover:border-aegean-200'
                }`}
              >
                <p className="font-medium text-aegean-800">
                  {PAYMENT_METHOD_LABELS[method.type] || method.name}
                </p>
                <p className="text-xs text-aegean-500 mt-0.5">{method.name}</p>
                {method.account_number && (
                  <p className="text-xs text-aegean-600 mt-1 truncate">{method.account_number}</p>
                )}
              </button>
            );
          })}
        </div>
        {!required && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-aegean-500 mt-2 hover:underline"
          >
            Clear selection
          </button>
        )}
      </div>

      {selected && (
        <PaymentQrPanel method={selected} reference={reference} amountDue={amountDue} />
      )}
    </div>
  );
}
