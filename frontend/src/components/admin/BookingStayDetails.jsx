import { useState } from 'react';
import { Image, Printer } from 'lucide-react';
import { getAssetUrl } from '../../utils/assetUrl';
import { formatGuestCount } from '../../utils/guestCount';
import { getBookingPaymentSummary } from '../../utils/bookingPayment';
import {
  isSeniorPassenger,
  isPwdPassenger,
  parseIslandHoppingData,
} from '../../data/islandHoppingRates';
import { getBilaoPackage, getBoodlePackage } from '../../data/bookingAddOns';
import {
  getOpenIslandHoppingPrintError,
  openIslandHoppingPrint,
} from '../../utils/openIslandHoppingPrint';
import { useToast } from '../../context/ToastContext';

const TABS = [
  { id: 'stay', label: 'Stay' },
  { id: 'guest', label: 'Guest' },
  { id: 'addons', label: 'Add-ons' },
  { id: 'payment', label: 'Payment' },
];

function Panel({ children }) {
  return <div className="space-y-1.5 text-aegean-700">{children}</div>;
}

function Row({ label, value, children }) {
  const content = children ?? value;
  if (content == null || content === '') return null;
  return (
    <p className="text-sm">
      <span className="text-aegean-500">{label}:</span>{' '}
      <span className="text-aegean-800">{content}</span>
    </p>
  );
}

export function bookingRoomStayTotal(booking) {
  if (!booking) return 0;
  return (
    Number(booking.total_amount) -
    Number(booking.island_hopping_amount || 0) -
    Number(booking.bilao_amount || 0) -
    Number(booking.boodle_fight_amount || 0)
  );
}

/** Read-only booking summary with the same tabs as the edit form */
export default function BookingStayDetails({ booking, onViewPaymentProof, onEdit }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('stay');
  const [printLoading, setPrintLoading] = useState(false);

  if (!booking) return null;

  const islandHop = booking.island_hopping
    ? parseIslandHoppingData(booking.island_hopping_data)
    : null;
  const roomStayTotal = bookingRoomStayTotal(booking);
  const payment = getBookingPaymentSummary(booking);

  return (
    <div className="flex flex-col">
      <div className="flex gap-1 p-1 bg-aegean-50 rounded-xl mb-5 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-xs sm:text-sm py-2.5 px-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-aegean-800 font-medium shadow-sm'
                : 'text-aegean-600 hover:text-aegean-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[220px]">
        {activeTab === 'stay' && (
          <Panel>
            <Row label="Room" value={booking.room_name} />
            <Row
              label="Dates"
              value={`${booking.check_in} → ${booking.check_out} (${booking.nights} night${booking.nights !== 1 ? 's' : ''})`}
            />
            <Row label="Guests" value={formatGuestCount(booking)} />
            {Number(booking.extra_person_charges) > 0 && (
              <Row
                label="Extra guest charges"
                value={`₱${Number(booking.extra_person_charges).toLocaleString()}`}
              />
            )}
          </Panel>
        )}

        {activeTab === 'guest' && (
          <Panel>
            <Row label="Name" value={booking.guest_name} />
            <Row label="Email" value={booking.guest_email} />
            <Row label="Phone" value={booking.guest_phone} />
            <Row label="Valid ID" value={booking.valid_id} />
            <Row label="Estimated arrival" value={booking.estimated_arrival} />
          </Panel>
        )}

        {activeTab === 'addons' && (
          <Panel>
            <Row
              label="Car"
              value={
                booking.bringing_car
                  ? `${booking.car_count || 1} car${(booking.car_count || 1) !== 1 ? 's' : ''}`
                  : 'None'
              }
            />
            <Row
              label="Pets"
              value={
                Number(booking.pet_count) > 0
                  ? `${booking.pet_count} · deposit ₱${Number(booking.pet_deposit_amount || 0).toLocaleString()} (refundable)`
                  : 'None'
              }
            />
            {booking.bilao_package ? (
              <Row
                label="Bilao"
                value={`${getBilaoPackage(booking.bilao_package)?.label || booking.bilao_package} — ₱${Number(booking.bilao_amount || 0).toLocaleString()}`}
              />
            ) : (
              <Row label="Bilao" value="None" />
            )}
            {booking.boodle_fight ? (
              <Row
                label="Boodle fight"
                value={`${getBoodlePackage(booking.boodle_fight_tier)?.label || booking.boodle_fight_tier} — ₱${Number(booking.boodle_fight_amount || 0).toLocaleString()}`}
              />
            ) : (
              <Row label="Boodle fight" value="None" />
            )}
            {booking.island_hopping ? (
              <Row
                label="Island hopping"
                value={`₱${Number(booking.island_hopping_amount || 0).toLocaleString()}`}
              />
            ) : (
              <Row label="Island hopping" value="None" />
            )}

            {islandHop && (
              <div className="border-t border-aegean-100 pt-4 mt-4 space-y-2">
                <h3 className="text-sm font-medium text-aegean-800">Island hopping details</h3>
                {islandHop.boat_label && <Row label="Boat" value={islandHop.boat_label} />}
                <Row label="Passenger address" value={islandHop.passenger_address} />
                <Row label="Payor" value={islandHop.payor_name} />
                <Row label="Payor address" value={islandHop.payor_address} />
                <Row label="Payor phone" value={islandHop.payor_phone} />
                <Row label="Emergency contact" value={islandHop.emergency_contact_name} />
                <Row label="Emergency phone" value={islandHop.emergency_contact_phone} />
                {(islandHop.passengers || []).length > 0 && (
                  <div className="pt-2 space-y-3">
                    <p className="text-xs font-medium text-aegean-600 uppercase tracking-wide">
                      Tour guests
                    </p>
                    <ul className="space-y-3">
                      {(islandHop.passengers || []).map((p, i) => (
                        <li
                          key={i}
                          className="rounded-lg border border-aegean-100 bg-aegean-50/40 p-3 space-y-2 text-sm"
                        >
                          <p className="font-medium text-aegean-900">{p.full_name}</p>
                          <p className="text-xs text-aegean-600">
                            Age {p.age} · {p.gender} ·{' '}
                            {p.is_first_timer ? 'First timer' : 'Not first timer'}
                            {p.is_senior || isSeniorPassenger(p) ? ' · Senior' : ''}
                            {isPwdPassenger(p) ? ' · PWD' : ''}
                          </p>
                          {isSeniorPassenger(p) && (
                            <IdPreview label="Senior ID" url={p.senior_id_url} name={p.full_name} />
                          )}
                          {isPwdPassenger(p) && (
                            <IdPreview label="PWD ID" url={p.pwd_id_url} name={p.full_name} />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Panel>
        )}

        {activeTab === 'payment' && (
          <Panel>
            <Row label="Room stay" value={`₱${roomStayTotal.toLocaleString()}`} />
            {Number(booking.island_hopping_amount) > 0 && (
              <Row
                label="Island hopping"
                value={`₱${Number(booking.island_hopping_amount).toLocaleString()}`}
              />
            )}
            {Number(booking.bilao_amount) > 0 && (
              <Row label="Bilao" value={`₱${Number(booking.bilao_amount).toLocaleString()}`} />
            )}
            {Number(booking.boodle_fight_amount) > 0 && (
              <Row
                label="Boodle fight"
                value={`₱${Number(booking.boodle_fight_amount).toLocaleString()}`}
              />
            )}
            {Number(booking.discount_amount) > 0 && (
              <Row
                label="Discount"
                value={`−₱${Number(booking.discount_amount).toLocaleString()}${booking.discount_code ? ` (${booking.discount_code})` : ''}`}
              />
            )}
            <Row label="Booking total" value={`₱${payment.total.toLocaleString()}`} />
            <Row
              label={payment.upfrontLabel}
              value={
                <>
                  ₱{payment.payNow.toLocaleString()}
                  {payment.paymentOptionLabel && (
                    <span className="text-aegean-500"> ({payment.paymentOptionLabel})</span>
                  )}
                </>
              }
            />
            {payment.isPartial && (
              <Row label="Balance due" value={`₱${payment.balance.toLocaleString()}`} />
            )}
            <Row label="Payment method" value={booking.payment_method_name || '—'} />
            {booking.payment_proof_url && onViewPaymentProof && (
              <button
                type="button"
                onClick={() => onViewPaymentProof(getAssetUrl(booking.payment_proof_url))}
                className="text-sm text-aegean-600 underline hover:text-aegean-800"
              >
                View payment proof →
              </button>
            )}

            {(booking.special_requests || booking.rejection_reason || booking.admin_notes) && (
              <div className="border-t border-aegean-100 pt-4 mt-4 space-y-2">
                <h3 className="text-sm font-medium text-aegean-800">Notes</h3>
                <Row label="Special requests" value={booking.special_requests} />
                {booking.rejection_reason && (
                  <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                    Rejection reason: {booking.rejection_reason}
                  </p>
                )}
                <Row label="Admin notes" value={booking.admin_notes} />
              </div>
            )}
          </Panel>
        )}
      </div>

      {(onEdit || Boolean(booking.island_hopping)) && (
        <div className="border-t border-aegean-100 pt-4 mt-6 flex flex-wrap gap-3">
          {Boolean(booking.island_hopping) && (
            <button
              type="button"
              disabled={printLoading}
              onClick={async () => {
                setPrintLoading(true);
                try {
                  await openIslandHoppingPrint(booking.id);
                } catch (err) {
                  toast.error(getOpenIslandHoppingPrintError(err));
                } finally {
                  setPrintLoading(false);
                }
              }}
              className="btn-outline text-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Printer size={16} /> {printLoading ? 'Opening…' : 'Print manifest'}
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} className="btn-primary text-sm">
              Edit stay
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IdPreview({ label, url, name }) {
  if (!url) {
    return (
      <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 inline-block">
        {label} not uploaded yet
      </p>
    );
  }
  const assetUrl = getAssetUrl(url);
  const isPdf = String(url).toLowerCase().includes('.pdf');
  return (
    <div className="space-y-1">
      <a
        href={assetUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-aegean-600 underline inline-flex items-center gap-1"
      >
        <Image size={12} /> View {label}
      </a>
      {!isPdf && (
        <img
          src={assetUrl}
          alt={`${label} — ${name}`}
          className="max-h-24 rounded border border-aegean-100 object-contain"
        />
      )}
    </div>
  );
}
