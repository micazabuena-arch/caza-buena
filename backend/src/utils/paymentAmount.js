/** Down payment & amount-to-pay helpers */

export const DEFAULT_DEPOSIT_PERCENT = 20;

export function getDepositPercent(value) {
  const p = parseFloat(value);
  if (Number.isFinite(p) && p > 0 && p <= 100) return p;
  return DEFAULT_DEPOSIT_PERCENT;
}

export function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function calculateDepositAmount(totalAmount, depositPercent = DEFAULT_DEPOSIT_PERCENT) {
  return roundMoney((Number(totalAmount) * depositPercent) / 100);
}

/**
 * @param {'deposit'|'full'|'custom'} paymentOption
 * @returns {{ amount: number|null, error: string|null }}
 */
export function resolveAmountToPay(totalAmount, paymentOption, customAmount, depositPercent = DEFAULT_DEPOSIT_PERCENT) {
  const total = Number(totalAmount) || 0;
  if (total <= 0) return { amount: null, error: 'Invalid booking total' };

  if (paymentOption === 'full') {
    return { amount: roundMoney(total), error: null };
  }

  if (paymentOption === 'deposit') {
    return { amount: calculateDepositAmount(total, depositPercent), error: null };
  }

  if (paymentOption === 'custom') {
    const custom = parseFloat(customAmount);
    if (!Number.isFinite(custom) || custom <= 0) {
      return { amount: null, error: 'Enter a valid payment amount' };
    }
    if (custom > total) {
      return { amount: null, error: `Custom amount cannot exceed the booking total (₱${total.toLocaleString()})` };
    }
    return { amount: roundMoney(custom), error: null };
  }

  return { amount: null, error: 'Select how much you will pay' };
}
