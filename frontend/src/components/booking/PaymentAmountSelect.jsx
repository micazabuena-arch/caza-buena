/**
 * Guest chooses down payment (20%), full amount, or custom payment.
 */
export default function PaymentAmountSelect({
  totalAmount,
  depositPercent,
  paymentOption,
  customAmount,
  onOptionChange,
  onCustomAmountChange,
}) {
  const total = Number(totalAmount) || 0;
  const pct = Number(depositPercent) || 20;
  const depositAmount = Math.round(((total * pct) / 100) * 100) / 100;

  const options = [
    {
      id: 'deposit',
      title: `Down payment (${pct}%)`,
      desc: `Pay ₱${depositAmount.toLocaleString()} now · balance due later`,
      amount: depositAmount,
    },
    {
      id: 'full',
      title: 'Full payment',
      desc: `Pay the full booking total of ₱${total.toLocaleString()}`,
      amount: total,
    },
    {
      id: 'custom',
      title: 'Custom amount',
      desc: 'Enter how much you want to pay now',
      amount: null,
    },
  ];

  const selectedAmount =
    paymentOption === 'deposit'
      ? depositAmount
      : paymentOption === 'full'
        ? total
        : parseFloat(customAmount) || 0;

  return (
    <div className="space-y-4 rounded-xl border border-aegean-200 bg-white p-5">
      <div>
        <p className="font-medium text-aegean-800">How much will you pay now?</p>
        <p className="text-xs text-aegean-500 mt-1">
          Booking total: ₱{total.toLocaleString()} · Upload proof for the amount you select below
        </p>
      </div>

      <div className="grid gap-3">
        {options.map((opt) => {
          const active = paymentOption === opt.id;
          return (
            <label
              key={opt.id}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                active ? 'border-aegean-500 bg-aegean-50' : 'border-aegean-100 hover:border-aegean-200'
              }`}
            >
              <input
                type="radio"
                name="payment_option"
                value={opt.id}
                checked={active}
                onChange={() => onOptionChange(opt.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="font-medium text-aegean-800">{opt.title}</p>
                <p className="text-xs text-aegean-600 mt-0.5">{opt.desc}</p>
                {opt.id !== 'custom' && active && (
                  <p className="text-sm font-semibold text-aegean-600 mt-2">
                    Amount to pay: ₱{opt.amount.toLocaleString()}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {paymentOption === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-aegean-700 mb-1">Amount to pay (₱) *</label>
          <input
            type="number"
            min={1}
            max={total}
            step={0.01}
            value={customAmount}
            onChange={(e) => onCustomAmountChange(e.target.value)}
            placeholder={`Up to ₱${total.toLocaleString()}`}
            className="w-full border border-aegean-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aegean-400 outline-none"
            required
          />
        </div>
      )}

      {total > 0 && selectedAmount > 0 && selectedAmount <= total && (
        <p className="text-sm text-center bg-aegean-100 text-aegean-800 rounded-lg py-2 px-3 font-medium">
          You will pay: ₱{selectedAmount.toLocaleString()}
          {selectedAmount < total && (
            <span className="block text-xs font-normal text-aegean-600 mt-1">
              Remaining balance: ₱{(total - selectedAmount).toLocaleString()} (pay at the resort / later)
            </span>
          )}
        </p>
      )}
    </div>
  );
}
