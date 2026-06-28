import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Printer, Trash2 } from 'lucide-react';
import api, { getApiError } from '../api/client';
import QuotationDocument from '../components/admin/QuotationDocument';
import { BILAO_PACKAGES, BOODLE_FIGHT_PACKAGES } from '../data/bookingAddOns';
import { ISLAND_HOPPING_RATES } from '../data/islandHoppingRates';
import {
  computeQuotationTotals,
  emptyQuotation,
  emptyQuotationRoom,
  formatQuoteAmount,
} from '../utils/quotation';
import { openQuotationPrint } from '../utils/openQuotationPrint';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-aegean-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function AdminQuotation() {
  const [quote, setQuote] = useState(emptyQuotation);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    api
      .get('/rooms/admin/all')
      .then((r) => setRooms(r.data || []))
      .catch(() => setRooms([]));
  }, []);

  const totals = useMemo(() => computeQuotationTotals(quote), [quote]);

  const patch = (fields) => setQuote((q) => ({ ...q, ...fields }));

  const patchRoom = (index, fields) => {
    setQuote((q) => {
      const next = [...q.rooms];
      next[index] = { ...next[index], ...fields };
      return { ...q, rooms: next };
    });
  };

  const addRoom = () => {
    setQuote((q) => ({ ...q, rooms: [...q.rooms, emptyQuotationRoom()] }));
  };

  const removeRoom = (index) => {
    setQuote((q) => ({
      ...q,
      rooms: q.rooms.length > 1 ? q.rooms.filter((_, i) => i !== index) : q.rooms,
    }));
  };

  const applyRoomFromList = (index, roomId) => {
    const room = rooms.find((r) => String(r.id) === String(roomId));
    if (!room) return;
    patchRoom(index, {
      roomType: room.name?.toUpperCase() || '',
      rate: room.price_per_night ?? '',
      occupants: room.included_adults ?? room.min_guests ?? 2,
    });
  };

  const loadFromBooking = async () => {
    const ref = window.prompt('Enter booking reference code (e.g. CB-20260627-8B0C):');
    if (!ref?.trim()) return;
    try {
      const { data: list } = await api.get('/bookings/admin/all');
      const booking = list.find(
        (b) => b.reference_code?.toUpperCase() === ref.trim().toUpperCase()
      );
      if (!booking) {
        window.alert('Booking not found.');
        return;
      }
      const detail = (await api.get(`/bookings/admin/${booking.id}`)).data;
      const roomLines =
        detail.room_lines?.length > 0
          ? detail.room_lines.map((line) => ({
              roomType: line.room_name?.toUpperCase() || '',
              occupants: line.guest_count || line.adults || 2,
              rate: line.room_rate || line.subtotal / Math.max(1, line.nights) || '',
              nights: line.nights || detail.nights || 1,
            }))
          : [
              {
                roomType: detail.room_name?.toUpperCase() || '',
                occupants: detail.guest_count || detail.adults || 2,
                rate: detail.room_rate || '',
                nights: detail.nights || 1,
              },
            ];

      const island = detail.island_hopping_data
        ? typeof detail.island_hopping_data === 'string'
          ? JSON.parse(detail.island_hopping_data)
          : detail.island_hopping_data
        : null;

      let tourRegularQty = 0;
      let tourSeniorPwdQty = 0;
      let tourInfantQty = 0;
      if (island?.passengers?.length) {
        island.passengers.forEach((p) => {
          const age = parseInt(p.age, 10);
          if (Number.isFinite(age) && age <= 4) tourInfantQty += 1;
          else if (p.is_pwd || p.is_senior || age >= 60) tourSeniorPwdQty += 1;
          else tourRegularQty += 1;
        });
      }

      const pax = island?.passengers?.length || detail.guest_count || 2;
      const boatTier =
        ISLAND_HOPPING_RATES.boat.find((b) => pax >= b.min && pax <= b.max)?.id || 'small';

      setQuote({
        ...emptyQuotation(),
        rmNo: detail.room_name ? `RM. ${detail.room_name.replace(/\D/g, '').slice(-3) || detail.room_name}` : '',
        dateLabel: `${detail.check_in} – ${detail.check_out}`,
        guestName: detail.guest_name?.toUpperCase() || '',
        bookingPlatform: '',
        pax: detail.guest_count || 2,
        rooms: roomLines,
        discountAmount: detail.discount_amount || '',
        discountLabel: detail.discount_code || detail.discount_note || '',
        downPaymentAmount: detail.amount_to_pay < detail.total_amount ? detail.amount_to_pay : '',
        downPaymentLabel:
          detail.amount_to_pay < detail.total_amount ? 'Amount paid / down payment' : '',
        tourEnabled: Boolean(detail.island_hopping),
        tourRegularQty,
        tourSeniorPwdQty,
        tourInfantQty,
        boatTierId: boatTier,
        bilaoPackageId: detail.bilao_package || '',
        boodleFightTierId: detail.boodle_fight_tier || '',
      });
    } catch (err) {
      window.alert(getApiError(err));
    }
  };

  const openPrint = () => openQuotationPrint(quote);

  return (
    <div className="admin-quotation-page">
      <style>{`
        @page { size: letter; margin: 0.5in; }
        @media print {
          .no-print { display: none !important; }
          .admin-quotation-page { padding: 0 !important; margin: 0 !important; }
          .quotation-preview {
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          html, body { background: white !important; }
          .quotation-doc, .quotation-doc * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-aegean-800">Quotation</h1>
          <p className="text-sm text-aegean-600 mt-1">
            Build a booking quotation, then print or save as PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadFromBooking}
            className="px-4 py-2 rounded-lg border border-aegean-200 text-sm hover:bg-aegean-50"
          >
            Load from booking
          </button>
          <button
            type="button"
            onClick={() => setQuote(emptyQuotation())}
            className="px-4 py-2 rounded-lg border border-aegean-200 text-sm hover:bg-aegean-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={openPrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aegean-600 text-white text-sm hover:bg-aegean-700"
          >
            <Printer size={16} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-8 items-start">
        <div className="no-print space-y-6">
          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-4">
            <h2 className="font-medium text-aegean-800">Guest & stay</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="RM No.">
                <input
                  className={inputClass}
                  value={quote.rmNo}
                  onChange={(e) => patch({ rmNo: e.target.value })}
                  placeholder="RM. 302"
                />
              </Field>
              <Field label="Date (display)">
                <input
                  className={inputClass}
                  value={quote.dateLabel}
                  onChange={(e) => patch({ dateLabel: e.target.value })}
                  placeholder="May 22–24, 2026"
                />
              </Field>
              <Field label="Guest name">
                <input
                  className={inputClass}
                  value={quote.guestName}
                  onChange={(e) => patch({ guestName: e.target.value })}
                />
              </Field>
              <Field label="Booking platform">
                <input
                  className={inputClass}
                  value={quote.bookingPlatform}
                  onChange={(e) => patch({ bookingPlatform: e.target.value })}
                  placeholder="FB, Airbnb, Walk-in…"
                />
              </Field>
              <Field label="Pax">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={quote.pax}
                  onChange={(e) => patch({ pax: e.target.value })}
                />
              </Field>
              <Field label="Check-in time">
                <input
                  className={inputClass}
                  value={quote.checkInTime}
                  onChange={(e) => patch({ checkInTime: e.target.value })}
                />
              </Field>
              <Field label="Check-out time">
                <input
                  className={inputClass}
                  value={quote.checkOutTime}
                  onChange={(e) => patch({ checkOutTime: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium text-aegean-800">Accommodation</h2>
              <button
                type="button"
                onClick={addRoom}
                className="inline-flex items-center gap-1 text-xs text-aegean-600 hover:text-aegean-800"
              >
                <Plus size={14} /> Add room
              </button>
            </div>
            {quote.rooms.map((row, index) => (
              <div key={index} className="rounded-lg border border-aegean-100 p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-aegean-600">Room {index + 1}</p>
                  {quote.rooms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRoom(index)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Remove room"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {rooms.length > 0 && (
                  <Field label="Fill from room list">
                    <select
                      className={inputClass}
                      value=""
                      onChange={(e) => applyRoomFromList(index, e.target.value)}
                    >
                      <option value="">Select room…</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} — ₱{Number(r.price_per_night).toLocaleString()}/night
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Room type">
                    <input
                      className={inputClass}
                      value={row.roomType}
                      onChange={(e) => patchRoom(index, { roomType: e.target.value })}
                      placeholder="COUPLE ROOM"
                    />
                  </Field>
                  <Field label="Occupants">
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={row.occupants}
                      onChange={(e) => patchRoom(index, { occupants: e.target.value })}
                    />
                  </Field>
                  <Field label="Rate / night (₱)">
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={row.rate}
                      onChange={(e) => patchRoom(index, { rate: e.target.value })}
                    />
                  </Field>
                  <Field label="Nights">
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={row.nights}
                      onChange={(e) => patchRoom(index, { nights: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="text-xs text-aegean-500">
                  Line total: ₱
                  {formatQuoteAmount(
                    (parseFloat(row.rate) || 0) * (parseInt(row.nights, 10) || 1)
                  )}
                </p>
              </div>
            ))}
            <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-aegean-100">
              <Field label="Discount label">
                <input
                  className={inputClass}
                  value={quote.discountLabel}
                  onChange={(e) => patch({ discountLabel: e.target.value })}
                  placeholder="Anniversary promo"
                />
              </Field>
              <Field label="Discount amount (₱)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={quote.discountAmount}
                  onChange={(e) => patch({ discountAmount: e.target.value })}
                />
              </Field>
              <Field label="Down payment label">
                <input
                  className={inputClass}
                  value={quote.downPaymentLabel}
                  onChange={(e) => patch({ downPaymentLabel: e.target.value })}
                  placeholder="Down payment via BPI…"
                />
              </Field>
              <Field label="Down payment (₱)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={quote.downPaymentAmount}
                  onChange={(e) => patch({ downPaymentAmount: e.target.value })}
                />
              </Field>
            </div>
            <p className="text-sm font-medium text-aegean-800">
              Accommodation balance: ₱{formatQuoteAmount(totals.accommodation.balance)}
            </p>
          </section>

          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-aegean-800">
              <input
                type="checkbox"
                checked={quote.tourEnabled}
                onChange={(e) => patch({ tourEnabled: e.target.checked })}
              />
              Include Hundred Islands tour
            </label>
            {quote.tourEnabled && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Regular entrance (5–59) — qty">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={quote.tourRegularQty}
                    onChange={(e) => patch({ tourRegularQty: e.target.value })}
                  />
                </Field>
                <Field label="Senior / PWD — qty">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={quote.tourSeniorPwdQty}
                    onChange={(e) => patch({ tourSeniorPwdQty: e.target.value })}
                  />
                </Field>
                <Field label="Infant (0–4) — qty">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={quote.tourInfantQty}
                    onChange={(e) => patch({ tourInfantQty: e.target.value })}
                  />
                </Field>
                <Field label="Boat size">
                  <select
                    className={inputClass}
                    value={quote.boatTierId}
                    onChange={(e) => patch({ boatTierId: e.target.value })}
                  >
                    {ISLAND_HOPPING_RATES.boat.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label} — ₱{b.rate.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            {quote.tourEnabled && (
              <p className="text-sm font-medium text-aegean-800">
                Tour total: ₱{formatQuoteAmount(totals.tour.total)}
              </p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-3">
            <h2 className="font-medium text-aegean-800">Seafood bilao (optional)</h2>
            <Field label="Package">
              <select
                className={inputClass}
                value={quote.bilaoPackageId}
                onChange={(e) => patch({ bilaoPackageId: e.target.value })}
              >
                <option value="">None</option>
                {BILAO_PACKAGES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.pax} pax) — ₱{p.price.toLocaleString()}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          <section className="bg-white rounded-xl border border-aegean-100 p-5 space-y-3">
            <h2 className="font-medium text-aegean-800">Boodle fight (optional)</h2>
            <Field label="Group size">
              <select
                className={inputClass}
                value={quote.boodleFightTierId}
                onChange={(e) => patch({ boodleFightTierId: e.target.value })}
              >
                <option value="">None</option>
                {BOODLE_FIGHT_PACKAGES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — ₱{p.price.toLocaleString()}
                  </option>
                ))}
              </select>
            </Field>
            {quote.boodleFightTierId && (
              <p className="text-sm text-aegean-600">
                Boodle fight: ₱{formatQuoteAmount(totals.boodleFight.total)}
              </p>
            )}
          </section>

          <p className="text-lg font-serif text-aegean-800">
            Grand total: ₱{formatQuoteAmount(totals.grandTotal)}
          </p>
        </div>

        <div className="quotation-preview bg-white rounded-xl border border-aegean-100 p-4 sm:p-6 shadow-sm print:border-0 print:shadow-none print:p-0">
          <p className="no-print text-xs text-aegean-500 mb-3 uppercase tracking-wide">Preview</p>
          <QuotationDocument quote={quote} />
        </div>
      </div>

      <p className="no-print text-xs text-aegean-500 mt-6">
        Tip: <strong>Print / PDF</strong> opens the printable page (new tab if allowed, otherwise this tab).
        Enable <strong>Background graphics</strong> for colors. Use <strong>Back to quotation</strong> when
        done.{' '}
        <Link to="/admin/bookings" className="underline">
          Back to bookings
        </Link>
      </p>
    </div>
  );
}
