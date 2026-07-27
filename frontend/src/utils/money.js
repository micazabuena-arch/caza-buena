/** Format peso amounts — shows centavos when present (e.g. 1,990.45). */
export function formatMoney(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const MONEY_INPUT_STEP = '0.01';
