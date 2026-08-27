/** Mobile/tablet card row for booking lists in admin */

export default function AdminBookingCard({
  booking,
  selected,
  statusColors,
  formatStatus,
  formatGuestCount,
  payLabel = 'Pay now',
  payAmount,
  paySubtext,
  statusBadge,
  roomsCell,
  actions,
}) {
  const pay =
    payAmount ??
    Number(booking.amount_to_pay ?? booking.total_amount ?? 0);

  return (
    <article
      className={`rounded-xl border p-4 space-y-3 shadow-sm ${
        selected ? 'border-aegean-400 bg-aegean-50' : 'border-aegean-100 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-mono text-xs text-aegean-600 break-all">{booking.reference_code}</p>
        {statusBadge || (
          <span
            className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
              statusColors[booking.status] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {formatStatus(booking.status)}
          </span>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-medium text-aegean-900">{booking.guest_name}</p>
        {booking.guest_email && (
          <p className="text-xs text-aegean-500 break-all">{booking.guest_email}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-aegean-500">Room</dt>
          <dd className="text-aegean-800 font-medium">
            {roomsCell || booking.room_name}
          </dd>
        </div>
        <div>
          <dt className="text-aegean-500">Guests</dt>
          <dd className="text-aegean-800">{formatGuestCount(booking)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-aegean-500">Dates</dt>
          <dd className="text-aegean-800">
            {booking.check_in} → {booking.check_out}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-aegean-500">{payLabel}</dt>
          <dd className="text-aegean-800 font-medium">₱{pay.toLocaleString()}</dd>
          {paySubtext}
        </div>
      </dl>

      {actions && <div className="pt-1 border-t border-aegean-100">{actions}</div>}
    </article>
  );
}
