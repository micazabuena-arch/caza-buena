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
import {
  describeBilaoBooking,
  describeBoodleBooking,
} from '../../data/bookingAddOns';
import {
  getOpenIslandHoppingPrintError,
  openIslandHoppingPrint,
} from '../../utils/openIslandHoppingPrint';
import { getBookingPaymentMethodLabel } from '../../data/manualBookingPayment';
import { openBookingSoaPrint } from '../../utils/openBookingSoaPrint';
import { bookingRoomStayTotal } from '../../utils/bookingSoaLines';
import { parseStayAddons } from '../../utils/stayAddons';
import { SOA_DOCUMENT_TYPES } from '../../utils/soaDocumentTitle';
import { useToast } from '../../context/ToastContext';
import { getGuestRoomLabel } from '../../data/resortRules';

const TABS = [
  { id: 'stay', label: 'Stay' },
  { id: 'guest', label: 'Guest' },
  { id: 'addons', label: 'Add-ons' },
  { id: 'custom-addons', label: 'Extra charges' },
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

/** Read-only booking summary with the same tabs as the edit form.
 *  During-stay add-ons are edited on the booking edit page, not here. */
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
  const stayAddons = parseStayAddons(booking.stay_addons);
  const stayAddonsTotal = stayAddons.reduce((sum, item) => sum + item.amount, 0);
  // Admin-only during-stay charges (room extension, food, etc.) — read-only here;
  // edited on the booking edit page.
  const customAddons = Array.isArray(booking.addons) ? booking.addons : [];
  const customAddonsTotal = customAddons.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const bilaoDesc = describeBilaoBooking(booking);
  const boodleDesc = describeBoodleBooking(booking);

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
            <Row
              label={booking.room_lines?.length > 1 ? 'Rooms' : 'Room'}
              value={
                booking.room_lines?.length
                  ? booking.room_lines.map((line) => {
                      const guests =
                        (line.adults || 0) +
                        (line.children_under6 || 0) +
                        (line.children_7_12 || 0);
                      const label =
                        line.assigned_room_number ||
                        line.admin_room_display ||
                        line.guest_room_label ||
                        getGuestRoomLabel(line);
                      const bookedAs = line.guest_room_label || getGuestRoomLabel(line);
                      const display =
                        line.assigned_room_number && bookedAs !== label
                          ? `${bookedAs} · ${line.assigned_room_number}`
                          : label;
                      return `${display} (${guests} guest${guests !== 1 ? 's' : ''})`;
                    }).join(' · ')
                  : booking.room_name
              }
            />
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
            {bilaoDesc ? (
              <Row
                label="Bilao"
                value={`${bilaoDesc.label} — ₱${bilaoDesc.amount.toLocaleString()}`}
              />
            ) : (
              <Row label="Bilao" value="None" />
            )}
            {boodleDesc ? (
              <Row
                label="Boodle fight"
                value={`${boodleDesc.label} — ₱${boodleDesc.amount.toLocaleString()}`}
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

        {activeTab === 'custom-addons' && (
          <Panel>
            {customAddons.length === 0 ? (
              <p className="text-sm text-aegean-500">No extra charges recorded.</p>
            ) : (
              <div className="space-y-2">
                {customAddons.map((addon) => (
                  <div
                    key={addon.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-aegean-100 bg-aegean-50/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-aegean-800">{addon.label}</span>
                        {!Number(addon.include_in_soa) && (
                          <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            Hidden from SOA
                          </span>
                        )}
                        {!Number(addon.include_in_confirmation) && (
                          <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            Hidden from confirmation
                          </span>
                        )}
                      </div>
                      {addon.description && (
                        <p className="text-xs text-aegean-500 mt-0.5">{addon.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-aegean-900 shrink-0">
                      ₱{Number(addon.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-aegean-100 pt-2 text-sm font-semibold text-aegean-800">
                  <span>Extra charges total</span>
                  <span>₱{customAddonsTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
            <p className="text-xs text-aegean-500 mt-3">
              Room extension, food orders, and other during-stay charges. Edit these on the booking
              edit page.
            </p>
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
            {stayAddons.map((item) => (
              <Row
                key={item.id}
                label={item.description}
                value={`₱${item.amount.toLocaleString()}`}
              />
            ))}
            {stayAddonsTotal > 0 && stayAddons.length > 1 && (
              <Row label="During-stay subtotal" value={`₱${stayAddonsTotal.toLocaleString()}`} />
            )}
            {customAddons.map((addon) => (
              <Row
                key={addon.id}
                label={addon.label || 'Extra charge'}
                value={`₱${Number(addon.amount || 0).toLocaleString()}`}
              />
            ))}
            {Number(booking.discount_amount) > 0 && (
              <Row
                label="Discount"
                value={`−₱${Number(booking.discount_amount).toLocaleString()}${
                  booking.discount_code
                    ? ` (${booking.discount_code})`
                    : booking.discount_note
                      ? ` (${booking.discount_note})`
                      : ''
                }`}
              />
            )}
            <Row label="Booking total" value={`₱${payment.total.toLocaleString()}`} />
            {payment.paymentLines?.length > 0 ? (
              <>
                {payment.paymentLines.map((line) => (
                  <Row
                    key={line.id || `${line.label}-${line.amount}`}
                    label={line.label}
                    value={`₱${line.amount.toLocaleString()}`}
                  />
                ))}
                <Row
                  label="Total amount paid"
                  value={`₱${payment.payNow.toLocaleString()}`}
                />
              </>
            ) : (
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
            )}
            {payment.isPartial && (
              <Row label="Balance due" value={`₱${payment.balance.toLocaleString()}`} />
            )}
            <Row label="Payment method" value={getBookingPaymentMethodLabel(booking) || '—'} />
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

      {(onEdit || Boolean(booking.island_hopping) || Boolean(booking.reference_code)) && (
        <div className="border-t border-aegean-100 pt-4 mt-6 flex flex-wrap gap-3">
          {booking.reference_code && (
            <>
              <button
                type="button"
                onClick={() => {
                  try {
                    openBookingSoaPrint(booking.id, 'soa');
                  } catch (err) {
                    toast.error(err.message || 'Could not open printable statement of account.');
                  }
                }}
                className="btn-outline text-sm inline-flex items-center gap-2"
              >
                <Printer size={16} /> {SOA_DOCUMENT_TYPES.soa.printLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    openBookingSoaPrint(booking.id, 'confirmation');
                  } catch (err) {
                    toast.error(err.message || 'Could not open printable document.');
                  }
                }}
                className="btn-outline text-sm inline-flex items-center gap-2"
              >
                <Printer size={16} /> {SOA_DOCUMENT_TYPES.confirmation.printLabel}
              </button>
            </>
          )}
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
