import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { roomGuestCapacityLabel } from '../../data/resortRules';
import { roomLineGuestCount } from '../../utils/bookingRoomLines';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none';

function RoomLineCard({
  line,
  index,
  rooms,
  roomLocked,
  lineQuote,
  quoteLoading,
  onChange,
  onRemove,
  canRemove,
  roomsSearchUrl,
  usedRoomIds,
  allowUnavailable,
}) {
  const selectedRoom = rooms.find((r) => String(r.id) === String(line.room_id));
  const guestCount = roomLineGuestCount(line);
  const maxG =
    lineQuote?.room_limits?.max_guests ??
    selectedRoom?.max_guests ??
    selectedRoom?.capacity ??
    99;
  const minG = lineQuote?.room_limits?.min_guests ?? selectedRoom?.min_guests ?? 1;
  const capacityLabel =
    lineQuote?.room_limits?.capacity_summary || roomGuestCapacityLabel(selectedRoom);
  const overCapacity = selectedRoom && guestCount > maxG;
  const underCapacity = selectedRoom && guestCount < minG;
  const lockThisRoom = roomLocked && index === 0;
  const browseUrl = typeof roomsSearchUrl === 'function' ? roomsSearchUrl() : null;

  const availableRooms = rooms.filter((r) => {
    const id = String(r.id);
    if (usedRoomIds.has(id) && id !== String(line.room_id)) return false;
    return true;
  });

  const update = (patch) => onChange(line.id, patch);
  const calendarConflict =
    line.room_id && lineQuote && !lineQuote.available && !lineQuote.occupancy_error;

  return (
    <div className="rounded-xl border border-aegean-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-aegean-50/80 border-b border-aegean-100">
        <p className="text-sm font-medium text-aegean-800">
          Room {index + 1}
          {selectedRoom ? ` · ${selectedRoom.name}` : ''}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {lockThisRoom && selectedRoom ? (
          <div className="rounded-lg border border-aegean-100 bg-aegean-50/60 p-4">
            <p className="text-xs uppercase tracking-wider text-aegean-500 mb-1">Selected room</p>
            <p className="font-serif text-lg text-aegean-800">{selectedRoom.name}</p>
            {capacityLabel && (
              <p className="text-sm text-aegean-600 mt-1">{capacityLabel}</p>
            )}
            {browseUrl && (
              <Link to={browseUrl} className="text-sm text-aegean-500 hover:underline mt-2 inline-block">
                Change room
              </Link>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-aegean-700 mb-1.5">Room *</label>
            <select
              value={line.room_id}
              onChange={(e) => update({ room_id: e.target.value })}
              required
              className={inputClass}
            >
              <option value="">Select a room</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.min_guests ?? 1}–{r.max_guests ?? r.capacity} guests)
                </option>
              ))}
            </select>
            {!line.room_id && browseUrl && (
              <p className="text-xs text-aegean-500 mt-1.5">
                <Link to={browseUrl} className="underline">
                  Browse available rooms
                </Link>{' '}
                for your dates.
              </p>
            )}
          </div>
        )}

        {selectedRoom && capacityLabel && !lockThisRoom && (
          <p className="text-xs text-aegean-600">
            <span className="font-medium">Capacity: </span>
            {capacityLabel}
          </p>
        )}

        <div>
          <p className="text-sm font-medium text-aegean-700 mb-2">Guests for this room</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-aegean-600 mb-1">Adults *</label>
              <input
                type="number"
                min={1}
                value={line.adults}
                onChange={(e) => update({ adults: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-aegean-600 mb-1">Children (6 & below)</label>
              <input
                type="number"
                min={0}
                value={line.children_under6}
                onChange={(e) =>
                  update({ children_under6: e.target.value === '' ? '' : parseInt(e.target.value, 10) })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-aegean-600 mb-1">Children (7–12)</label>
              <input
                type="number"
                min={0}
                value={line.children_7_12}
                onChange={(e) =>
                  update({ children_7_12: e.target.value === '' ? '' : parseInt(e.target.value, 10) })
                }
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {quoteLoading && line.room_id && (
          <p className="text-xs text-aegean-500">Checking availability & pricing…</p>
        )}
        {lineQuote?.occupancy_error && (
          <p className="text-sm text-red-600">{lineQuote.occupancy_error}</p>
        )}
        {calendarConflict && !allowUnavailable && (
          <p className="text-sm text-red-600">Not available for selected dates</p>
        )}
        {calendarConflict && allowUnavailable && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Calendar shows a conflict — ante-dated recording is still allowed for Statement of Account.
          </p>
        )}
        {overCapacity && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            This room allows up to {maxG} guest{maxG !== 1 ? 's' : ''}. Add another room below or
            lower the guest count for this room.
          </p>
        )}
        {underCapacity && (
          <p className="text-sm text-red-600">
            This room requires at least {minG} guest{minG !== 1 ? 's' : ''}.
          </p>
        )}
        {lineQuote?.subtotal != null &&
          (lineQuote.available || allowUnavailable) &&
          !lineQuote.occupancy_error && (
          <p className="text-sm text-aegean-700">
            Room subtotal: <strong>₱{Number(lineQuote.subtotal).toLocaleString()}</strong>
            {lineQuote.nights ? ` · ${lineQuote.nights} night(s)` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default function BookingRoomLinesSection({
  lines,
  rooms,
  roomLocked,
  lineQuotes,
  quotesLoading,
  onLineChange,
  onAddLine,
  onRemoveLine,
  roomsSearchUrl,
  usedRoomIds,
  allowUnavailable = false,
}) {
  const totalGuests = lines.reduce((s, l) => s + roomLineGuestCount(l), 0);

  return (
    <div className="space-y-4">
      {lines.map((line, index) => (
        <RoomLineCard
          key={line.id}
          line={line}
          index={index}
          rooms={rooms}
          roomLocked={roomLocked}
          lineQuote={lineQuotes[line.id]}
          quoteLoading={quotesLoading}
          onChange={onLineChange}
          onRemove={onRemoveLine}
          canRemove={lines.length > 1}
          roomsSearchUrl={roomsSearchUrl}
          usedRoomIds={usedRoomIds}
          allowUnavailable={allowUnavailable}
        />
      ))}

      <button
        type="button"
        onClick={onAddLine}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-aegean-200 text-sm font-medium text-aegean-700 hover:border-aegean-400 hover:bg-aegean-50/50 transition-colors"
      >
        <Plus size={18} />
        Add another room
      </button>

      {lines.length > 1 && (
        <p className="text-xs text-aegean-600 text-center">
          {lines.length} rooms · {totalGuests} guest(s) total across all rooms
        </p>
      )}
    </div>
  );
}
