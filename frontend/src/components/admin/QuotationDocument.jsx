import { resort } from '../../data/placeholders';
import { BILAO_PACKAGES, BOODLE_FIGHT_PACKAGES } from '../../data/bookingAddOns';
import { ISLAND_HOPPING_RATES } from '../../data/islandHoppingRates';
import {
  computeQuotationTotals,
  formatQuoteAmount,
  formatQuoteParen,
  getQuotationDateLabel,
} from '../../utils/quotation';

const CONTACT = {
  email: resort.email,
  phone: resort.phone,
  address: resort.location,
};

const th =
  'border border-gray-400 px-2 py-1 text-left text-[9pt] font-bold uppercase tracking-wide';
const td = 'border border-gray-400 px-2 py-1 text-[9pt]';
const tdRight = `${td} text-right`;
const tdCenter = `${td} text-center`;

/** Section colors — inline in print stylesheet so PDF keeps backgrounds. */
const PRINT_COLORS = `
  .quotation-doc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .q-accom-h1 th, .q-accom-h1 td { background-color: #bdd7ee !important; }
  .q-accom-h2 th, .q-accom-h2 td { background-color: #ddebf7 !important; }
  .q-accom-total th, .q-accom-total td { background-color: #5b9bd5 !important; color: #fff !important; }
  .q-tour-h1 th, .q-tour-h1 td { background-color: #f4b084 !important; }
  .q-tour-h2 th, .q-tour-h2 td { background-color: #fce4d6 !important; }
  .q-tour-total th, .q-tour-total td { background-color: #ed7d31 !important; color: #fff !important; }
  .q-bilao-h1 th, .q-bilao-h1 td { background-color: #a9d18e !important; }
  .q-bilao-h2 th, .q-bilao-h2 td { background-color: #c5e0b4 !important; }
  .q-bilao-total th, .q-bilao-total td { background-color: #548235 !important; color: #fff !important; }
  .q-boodle-h1 th, .q-boodle-h1 td { background-color: #dae8fc !important; }
  .q-boodle-h2 th, .q-boodle-h2 td { background-color: #e8f0fe !important; }
  .q-boodle-total th, .q-boodle-total td { background-color: #6d9eeb !important; color: #fff !important; }
  .q-custom-h1 th, .q-custom-h1 td { background-color: #d9d2e9 !important; }
  .q-custom-h2 th, .q-custom-h2 td { background-color: #ede7f6 !important; }
  .q-custom-total th, .q-custom-total td { background-color: #7e57c2 !important; color: #fff !important; }
  .q-grand-total th, .q-grand-total td { background-color: #ffd966 !important; }
`;

function MetaRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-baseline gap-x-2 text-[10pt] leading-snug">
      <span className="font-bold shrink-0 whitespace-nowrap">{label}</span>
      <span className={`min-w-0 ${valueClass}`}>{value || '—'}</span>
    </div>
  );
}

export default function QuotationDocument({
  quote,
  extraPersonRates,
  islandHoppingRates,
  foodAddOnRates,
}) {
  if (!quote) return null;

  const rates = islandHoppingRates || ISLAND_HOPPING_RATES;
  const bilaoPackages = foodAddOnRates?.bilaoPackages || BILAO_PACKAGES;
  const boodlePackages = foodAddOnRates?.boodlePackages || BOODLE_FIGHT_PACKAGES;
  const { accommodation, tour, bilao, boodleFight, customAddons, grandTotal } =
    computeQuotationTotals(quote, {
      extraPersonRates,
      islandHoppingRates: rates,
      foodAddOnRates,
    });
  const { entrance, garbageFee } = rates;
  const pax = quote.pax || accommodation.roomLines.reduce((s, r) => s + r.occupants, 0) || '—';

  const bilaoById = Object.fromEntries(bilao.lines.map((l) => [l.package.id, l]));
  const boodleById = Object.fromEntries(boodleFight.lines.map((l) => [l.package.id, l]));

  return (
    <article className="quotation-doc text-black max-w-[8.5in] mx-auto font-sans bg-white">
      <style>{PRINT_COLORS}</style>
      <header className="flex items-start justify-between gap-4 pb-2 mb-3 border-b-2 border-[#5b9bd5]">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/logo.png"
            alt=""
            className="h-14 w-auto object-contain shrink-0"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/CAZA_BUENA_LOGO.svg';
            }}
          />
          <div className="text-[#5b9bd5]">
            <p className="font-serif text-[18pt] font-bold leading-none m-0">CAZA BUENA</p>
            <p className="text-[8pt] m-0 mt-0.5">Est. 2024</p>
          </div>
        </div>
        <div className="text-right text-[8pt] leading-relaxed text-[#5b9bd5] shrink-0">
          <p className="m-0">{CONTACT.email}</p>
          <p className="m-0">{CONTACT.phone}</p>
          <p className="m-0 max-w-[220px] ml-auto">{CONTACT.address}</p>
        </div>
      </header>

      <h1 className="text-center text-[12pt] font-bold uppercase tracking-wider m-0 mb-4">
        {quote.documentTitle?.trim() || 'Quotation'}
      </h1>

      <section className="grid sm:grid-cols-2 gap-x-8 gap-y-1 mb-4 uppercase">
        <MetaRow label="RM No.:" value={quote.rmNo} valueClass="text-red-600 font-bold" />
        <MetaRow label="Date:" value={getQuotationDateLabel(quote)} />
        <MetaRow label="Check-in:" value={quote.checkInTime} />
        <MetaRow label="Check-out:" value={quote.checkOutTime} />
        <MetaRow label="Name:" value={quote.guestName} />
        <MetaRow label="Booking platform:" value={quote.bookingPlatform} />
        <MetaRow label="Pax:" value={String(pax)} />
      </section>

      {/* Accommodation */}
      <table className="w-full border-collapse mb-3">
        <thead>
          <tr className="q-accom-h1">
            <th className={th} colSpan={5}>
              Accommodation
            </th>
          </tr>
          <tr className="q-accom-h2">
            <th className={th}>Room type</th>
            <th className={th}>Occupants</th>
            <th className={th}>Rate</th>
            <th className={th}>No. of nights</th>
            <th className={`${th} text-right`}>Total rate</th>
          </tr>
        </thead>
        <tbody>
          {accommodation.roomLines.map((row, i) => (
            <tr key={`room-${i}`}>
              <td className={td}>{row.roomType}</td>
              <td className={tdCenter}>{row.occupants}</td>
              <td className={tdRight}>{formatQuoteAmount(row.rate)}</td>
              <td className={tdCenter}>{row.nights}</td>
              <td className={tdRight}>{formatQuoteAmount(row.total)}</td>
            </tr>
          ))}
          {accommodation.discount > 0 && (
            <tr>
              <td className={td} colSpan={4}>
                Less: {quote.discountLabel || 'Discount'}
              </td>
              <td className={tdRight}>{formatQuoteParen(accommodation.discount)}</td>
            </tr>
          )}
          <tr className="font-bold">
            <td className={td} colSpan={4}>
              Total
            </td>
            <td className={tdRight}>{formatQuoteAmount(accommodation.afterDiscount)}</td>
          </tr>
          {accommodation.downPayment > 0 && (
            <tr>
              <td className={td} colSpan={4}>
                Less: {quote.downPaymentLabel || 'Down payment'}
              </td>
              <td className={tdRight}>{formatQuoteParen(accommodation.downPayment)}</td>
            </tr>
          )}
          <tr className="q-accom-total font-bold">
            <td className={`${td} border-gray-400`} colSpan={2}>
              Balance total accommodation
            </td>
            <td className={`${td} border-gray-400 text-center`} colSpan={2}>
              {pax}
            </td>
            <td className={`${tdRight} border-gray-400`}>
              {formatQuoteAmount(accommodation.balance)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Island hopping */}
      {quote.tourEnabled && (
        <table className="w-full border-collapse mb-3">
          <thead>
            <tr className="q-tour-h1">
              <th className={th} colSpan={5}>
                Hundred islands hopping rates
              </th>
            </tr>
            <tr className="q-tour-h2">
              <th className={th} colSpan={2}>
                Item
              </th>
              <th className={th}>Rate</th>
              <th className={`${th} text-center`}>Qty</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td} colSpan={2}>
                Entrance fee (5–59 years old)
              </td>
              <td className={tdRight}>{formatQuoteAmount(entrance.regular.rate)}</td>
              <td className={tdCenter}>{tour.regularQty > 0 ? tour.regularQty : ''}</td>
              <td className={tdRight}>
                {tour.regularQty > 0 ? formatQuoteAmount(tour.regularTotal) : ''}
              </td>
            </tr>
            <tr>
              <td className={td} colSpan={2}>
                Senior citizen / PWD (with 20% discount)
              </td>
              <td className={tdRight}>{formatQuoteAmount(entrance.senior.rate)}</td>
              <td className={tdCenter}>{tour.seniorPwdQty > 0 ? tour.seniorPwdQty : ''}</td>
              <td className={tdRight}>
                {tour.seniorPwdQty > 0 ? formatQuoteAmount(tour.seniorPwdTotal) : ''}
              </td>
            </tr>
            <tr>
              <td className={td} colSpan={2}>
                Entrance fee (0–4 years old)
              </td>
              <td className={tdRight}>{formatQuoteAmount(entrance.infant.rate)}</td>
              <td className={tdCenter}>{tour.infantQty > 0 ? tour.infantQty : ''}</td>
              <td className={tdRight}>
                {tour.infantQty > 0 ? formatQuoteAmount(tour.infantTotal) : ''}
              </td>
            </tr>
            <tr>
              <td className={`${td} font-bold`} colSpan={5}>
                Motorboat rental
              </td>
            </tr>
            {tour.boatLines?.map((line, i) => (
              <tr key={`boat-${i}`}>
                <td className={td} colSpan={2}>
                  {line.boat.label}
                </td>
                <td className={tdRight}>{formatQuoteAmount(line.rate)}</td>
                <td className={tdCenter}>1</td>
                <td className={tdRight}>{formatQuoteAmount(line.lineTotal)}</td>
              </tr>
            ))}
            {tour.facilitationLines?.map((line, i) => (
              <tr key={`facilitation-${i}`}>
                <td className={td} colSpan={2}>
                  {line.label}
                </td>
                <td className={tdRight}>{formatQuoteAmount(line.rate)}</td>
                <td className={tdCenter}>{line.qty}</td>
                <td className={tdRight}>{formatQuoteAmount(line.total)}</td>
              </tr>
            ))}
            <tr>
              <td className={td} colSpan={2}>
                Garbage fee (refundable)
              </td>
              <td className={tdRight}>{formatQuoteAmount(garbageFee)}</td>
              <td className={tdCenter}>{tour.garbageQty > 0 ? tour.garbageQty : ''}</td>
              <td className={tdRight}>
                {tour.garbage > 0 ? formatQuoteAmount(tour.garbage) : ''}
              </td>
            </tr>
            <tr className="q-tour-total font-bold">
              <td className={`${td} border-gray-400`} colSpan={4}>
                Total tour
              </td>
              <td className={`${tdRight} border-gray-400`}>{formatQuoteAmount(tour.total)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Seafood bilao — only when included */}
      {quote.bilaoEnabled && (
        <table className="w-full border-collapse mb-3">
          <thead>
            <tr className="q-bilao-h1">
              <th className={th} colSpan={5}>
                Seafood bilao (optional)
              </th>
            </tr>
            <tr className="q-bilao-h2">
              <th className={th}>Description</th>
              <th className={th}>Size</th>
              <th className={th}>Rate</th>
              <th className={`${th} text-center`}>Qty</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {bilaoPackages.map((pkg) => {
              const selected = bilaoById[pkg.id];
              return (
                <tr key={pkg.id}>
                  <td className={td}>Good for {pkg.pax}pax</td>
                  <td className={td}>{pkg.label.toUpperCase()}</td>
                  <td className={tdRight}>{formatQuoteAmount(pkg.price)}</td>
                  <td className={tdCenter}>{selected ? selected.qty : ''}</td>
                  <td className={tdRight}>{selected ? formatQuoteAmount(selected.total) : ''}</td>
                </tr>
              );
            })}
            <tr className="q-bilao-total font-bold">
              <td className={`${td} border-gray-400`} colSpan={4}>
                Seafood bilao (optional)
              </td>
              <td className={`${tdRight} border-gray-400`}>{formatQuoteAmount(bilao.total)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Boodle fight — only when included */}
      {quote.boodleEnabled && (
        <table className="w-full border-collapse mb-3">
          <thead>
            <tr className="q-boodle-h1">
              <th className={th} colSpan={5}>
                Boodle fight (optional)
              </th>
            </tr>
            <tr className="q-boodle-h2">
              <th className={th} colSpan={2}>
                Description
              </th>
              <th className={th}>Rate</th>
              <th className={`${th} text-center`}>Qty</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {boodlePackages.map((pkg) => {
              const selected = boodleById[pkg.id];
              return (
                <tr key={pkg.id}>
                  <td className={td} colSpan={2}>
                    Good for {pkg.label}
                  </td>
                  <td className={tdRight}>{formatQuoteAmount(pkg.price)}</td>
                  <td className={tdCenter}>{selected ? selected.qty : ''}</td>
                  <td className={tdRight}>{selected ? formatQuoteAmount(selected.total) : ''}</td>
                </tr>
              );
            })}
            <tr className="q-boodle-total font-bold">
              <td className={`${td} border-gray-400`} colSpan={4}>
                Boodle fight (optional)
              </td>
              <td className={`${tdRight} border-gray-400`}>
                {formatQuoteAmount(boodleFight.total)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Custom add-ons — room extension, food, misc */}
      {quote.customAddonsEnabled && customAddons.lines.length > 0 && (
        <table className="w-full border-collapse mb-3">
          <thead>
            <tr className="q-custom-h1">
              <th className={th} colSpan={5}>
                {customAddons.sectionTitle}
              </th>
            </tr>
            <tr className="q-custom-h2">
              <th className={th} colSpan={2}>
                Item
              </th>
              <th className={th}>Rate</th>
              <th className={`${th} text-center`}>Qty</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {customAddons.lines.map((line, i) => (
              <tr key={`custom-addon-${i}`}>
                <td className={td} colSpan={2}>
                  {line.label}
                  {line.detail ? (
                    <span className="block text-[8pt] normal-case text-gray-700">{line.detail}</span>
                  ) : null}
                </td>
                <td className={tdRight}>{formatQuoteAmount(line.rate)}</td>
                <td className={tdCenter}>{line.qty}</td>
                <td className={tdRight}>{formatQuoteAmount(line.total)}</td>
              </tr>
            ))}
            <tr className="q-custom-total font-bold">
              <td className={`${td} border-gray-400`} colSpan={4}>
                {customAddons.sectionTitle}
              </td>
              <td className={`${tdRight} border-gray-400`}>
                {formatQuoteAmount(customAddons.total)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Grand total */}
      <table className="w-full border-collapse">
        <tbody>
          <tr className="q-grand-total font-bold">
            <td className={`${td} border-gray-400 text-[10pt]`} colSpan={4}>
              Total (accommodation + tour + seafood bilao + boodle fight
              {customAddons.total > 0 ? ' + other add-ons' : ''})
            </td>
            <td className={`${tdRight} border-gray-400 text-[10pt]`}>
              {formatQuoteAmount(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
