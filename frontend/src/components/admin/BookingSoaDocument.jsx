import { resort } from '../../data/placeholders';
import { getBookingPaymentSummary } from '../../utils/bookingPayment';
import {
  buildBookingSoaLineItems,
  formatSoaAmount,
} from '../../utils/bookingSoaLines';

/** Contact block shown on printed SOA (right-aligned header). */
const SOA_CONTACT = {
  email: resort.email,
  phone: resort.phone,
  address: resort.location,
};

const BRAND_BLUE = '#498bc3';

export default function BookingSoaDocument({
  booking,
  documentTitle = 'STATEMENT OF ACCOUNT',
  docType = 'soa',
}) {
  if (!booking) return null;

  const lineItems = buildBookingSoaLineItems(booking, docType);
  const payment = getBookingPaymentSummary(booking);
  const nightsLabel = `${booking.nights} NIGHT${booking.nights === 1 ? '' : 'S'}`;

  return (
    <article className="soa-doc text-black text-[11pt] leading-snug max-w-[8.5in] mx-auto font-sans">
      <header className="flex items-start justify-between gap-6 pb-3 border-b-2 border-[#498bc3] mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/logo.png"
            alt=""
            className="h-[72px] w-auto object-contain shrink-0"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/CAZA_BUENA_LOGO.svg';
            }}
          />
          <div className="text-[#498bc3]">
            <p className="font-serif text-[22pt] font-bold tracking-wide leading-none m-0">
              CAZA BUENA
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block w-10 border-t border-[#498bc3]" />
              <span className="text-[9pt]">Est. 2024</span>
              <span className="inline-block w-10 border-t border-[#498bc3]" />
            </div>
          </div>
        </div>

        <div
          className="text-right text-[9pt] leading-relaxed shrink-0"
          style={{ color: BRAND_BLUE }}
        >
          <p className="m-0">{SOA_CONTACT.email}</p>
          <p className="m-0">{SOA_CONTACT.phone}</p>
          <p className="m-0 max-w-[240px] ml-auto">{SOA_CONTACT.address}</p>
        </div>
      </header>

      <h1 className="text-center text-[13pt] font-bold uppercase tracking-wide m-0 mb-6">
        {documentTitle}
      </h1>

      <section className="mb-6 space-y-1 text-[11pt]">
        <p className="m-0">
          <strong>Guest:</strong> {booking.guest_name}
        </p>
        <p className="m-0">
          <strong>E-mail:</strong>{' '}
          <a href={`mailto:${booking.guest_email}`} className="text-[#498bc3] underline">
            {booking.guest_email}
          </a>
        </p>
        <p className="m-0">
          <strong>Phone:</strong> {booking.guest_phone || '—'}
        </p>
        <p className="m-0">
          <strong>{booking.room_count > 1 ? 'Rooms' : 'Room'}:</strong>{' '}
          {booking.room_lines?.length
            ? booking.room_lines.map((line) => line.room_name).join(', ')
            : booking.room_names || booking.room_name}
        </p>
        <p className="m-0">
          <strong>Stay Dates:</strong> {booking.check_in} - {booking.check_out} ( {nightsLabel} )
        </p>
      </section>

      <table className="w-full border-collapse text-[11pt] mb-6">
        <tbody>
          {lineItems.map((item, index) => (
            <tr key={`${item.label}-${index}`}>
              <td className="border border-black px-3 py-1.5">{item.label}</td>
              <td className="border border-black px-3 py-1.5 text-right w-[140px]">
                {formatSoaAmount(item.amount)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-black px-3 py-1.5 font-bold">Total</td>
            <td className="border border-black px-3 py-1.5 text-right font-bold w-[140px]">
              {formatSoaAmount(payment.total)}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1.5 font-bold">Amount Paid</td>
            <td className="border border-black px-3 py-1.5 text-right font-bold w-[140px]">
              {formatSoaAmount(payment.payNow)}
            </td>
          </tr>
          <tr>
            <td className="border border-black px-3 py-1.5 font-bold">Balance Due</td>
            <td className="border border-black px-3 py-1.5 text-right font-bold w-[140px]">
              {formatSoaAmount(payment.balance)}
            </td>
          </tr>
        </tbody>
      </table>

      <section className="mb-10 text-[10pt] leading-relaxed">
        <p className="m-0 mb-2">
          <strong>Payment information:</strong>
        </p>
        <p className="m-0 mb-2">
          Please pay via the preferred method, we accept cash, e-wallet, bank transfer, QR
          payments, debit card and credit card.
        </p>
        <p className="m-0 italic">
          *Note: We accept cash, bank transfers, and e-wallets for the Hundred Islands tour and
          seafood bilao. Payments made via credit or debit card are subject to a 3% processing
          fee*
        </p>
      </section>

      <footer className="text-[10pt]">
        <div className="flex justify-between items-end mb-16">
          <p className="m-0 font-bold">Cashier signature</p>
          <p className="m-0 font-bold">Guest signature</p>
        </div>
        <p className="text-center font-bold m-0">Thank you for Choosing Caza Buena!</p>
      </footer>
    </article>
  );
}
