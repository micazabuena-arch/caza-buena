import { Plus, Trash2, Upload } from 'lucide-react';
import { getAssetUrl } from '../../utils/assetUrl';
import {
  calculateIslandHopping,
  emptyPassenger,
  formatBoatPlanLabel,
  ISLAND_HOPPING_RATES,
  planBoatsForPax,
} from '../../data/islandHoppingRates';
import { YesNoChoice } from './FormSection';
import { digitsOnly } from '../../utils/inputSanitizers';

export default function IslandHoppingSection({
  enabled,
  onEnabledChange,
  data,
  onChange,
  embedded = false,
  // Admin manual booking / edit: guests may not supply passenger details up front,
  // so fields are not enforced. Public guest booking keeps them required.
  optionalFields = false,
  rates = ISLAND_HOPPING_RATES,
}) {
  const update = (patch) => onChange({ ...data, ...patch });

  // Whether to enforce the HTML `required` attribute and show the `*` marker.
  const fieldRequired = !optionalFields;
  const star = optionalFields ? '' : ' *';

  const updatePassenger = (index, field, value) => {
    const passengers = [...data.passengers];
    passengers[index] = { ...passengers[index], [field]: value };
    if (field === 'age') {
      const age = parseInt(value, 10);
      passengers[index].is_senior = Number.isFinite(age) && age >= 60;
      if (!passengers[index].is_senior) {
        passengers[index].senior_id_file = null;
      }
    }
    if (field === 'is_pwd' && value !== true) {
      passengers[index].pwd_id_file = null;
    }
    update({ passengers });
  };

  const renderIdUpload = (index, passenger, { label, fileField, file }) => (
    <div className="rounded-lg border border-dashed border-aegean-200 bg-aegean-50/50 p-3 space-y-2">
      <p className="text-xs text-aegean-700">{label}</p>
      <label className="flex items-center gap-2 text-sm text-aegean-600 cursor-pointer hover:text-aegean-800">
        <Upload size={14} />
        {file ? file.name : 'Choose ID file (JPG, PNG, WebP, or PDF)'}
        <input
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const chosen = e.target.files?.[0] || null;
            updatePassenger(index, fileField, chosen);
          }}
        />
      </label>
      {file && (
        <button
          type="button"
          onClick={() => updatePassenger(index, fileField, null)}
          className="text-xs text-red-600 hover:text-red-800"
        >
          Remove file
        </button>
      )}
    </div>
  );

  const addPassenger = () => {
    update({ passengers: [...data.passengers, emptyPassenger()] });
  };

  const removePassenger = (index) => {
    if (data.passengers.length <= 1) return;
    update({ passengers: data.passengers.filter((_, i) => i !== index) });
  };

  const quote = enabled && !data.soa_summary ? calculateIslandHopping(data.passengers, rates) : null;
  const summaryBoatPlan =
    data.soa_summary && data.summary_pax
      ? planBoatsForPax(parseInt(data.summary_pax, 10), rates)
      : null;
  const formComplete =
    enabled &&
    data.passenger_address?.trim() &&
    data.payor_name?.trim() &&
    data.payor_address?.trim() &&
    data.payor_phone?.trim() &&
    data.emergency_contact_name?.trim() &&
    data.emergency_contact_phone?.trim() &&
    quote?.complete;

  const wrapperClass = embedded
    ? 'border-t border-aegean-100 pt-6 space-y-5'
    : 'rounded-xl border border-aegean-200 bg-aegean-50/40 p-5 space-y-5';

  return (
    <div className={wrapperClass}>
      <div
        className={
          embedded
            ? 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'
            : 'space-y-3'
        }
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-aegean-800">Island hopping (Hundred Islands)</p>
          <p className="text-xs text-aegean-500 mt-0.5">
            Optional tour add-on · official Hundred Islands fee schedule
          </p>
        </div>
        <YesNoChoice
          name="island_hopping"
          value={enabled}
          yesLabel="Add"
          onChange={onEnabledChange}
        />
      </div>

      {enabled && (
        <div className="space-y-6 pt-2 border-t border-aegean-200">
          {optionalFields && (
            <div className="rounded-lg border border-aegean-200 bg-white p-4 space-y-3">
              <label className="flex items-start gap-2 text-sm text-aegean-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(data.soa_summary)}
                  onChange={(e) =>
                    update({
                      soa_summary: e.target.checked,
                      summary_pax: e.target.checked ? data.summary_pax || '' : '',
                      summary_amount: e.target.checked ? data.summary_amount || '' : '',
                    })
                  }
                  className="mt-1 rounded border-aegean-300 text-aegean-600 focus:ring-aegean-400"
                />
                <span>
                  <strong>Summary for SOA only</strong>
                  <span className="block text-xs text-aegean-500 mt-0.5">
                    Enter pax count and total amount only — no passenger list on the statement of
                    account. Use Print manifest later if you need the full guest list.
                  </span>
                </span>
              </label>
              {data.soa_summary && (
                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  <label className="block">
                    <span className="block text-xs font-medium text-aegean-600 mb-1">
                      Number of pax *
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={data.summary_pax}
                      onChange={(e) => update({ summary_pax: e.target.value })}
                      className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-aegean-600 mb-1">
                      Total amount (₱) *
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={data.summary_amount}
                      onChange={(e) => update({ summary_amount: e.target.value })}
                      className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {!data.soa_summary && (
          <>
          <div>
            <p className="text-sm font-medium text-aegean-800 mb-3">
              {`1. Guest details — name, age, gender, first-timer & PWD status${star}`}
            </p>
            {optionalFields && (
              <p className="text-xs text-aegean-500 mb-3 -mt-2">
                Passenger details are optional here — they can be completed later from the booking.
              </p>
            )}
            <div className="space-y-4">
              {data.passengers.map((p, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg border border-aegean-100 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-aegean-600">Guest {index + 1}</span>
                    {data.passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePassenger(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                        aria-label="Remove guest"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder={`Full name${star}`}
                    value={p.full_name}
                    onChange={(e) => updatePassenger(index, 'full_name', e.target.value)}
                    required={fieldRequired}
                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      placeholder={`Age${star}`}
                      value={p.age}
                      onChange={(e) => updatePassenger(index, 'age', e.target.value)}
                      required={fieldRequired}
                      className="border border-aegean-200 rounded-lg px-3 py-2 text-sm"
                    />
                    <select
                      value={p.gender}
                      onChange={(e) => updatePassenger(index, 'gender', e.target.value)}
                      required={fieldRequired}
                      className="border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="">{`Gender${star}`}</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <select
                      value={p.is_first_timer === '' ? '' : p.is_first_timer ? 'yes' : 'no'}
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          'is_first_timer',
                          e.target.value === '' ? '' : e.target.value === 'yes'
                        )
                      }
                      required={fieldRequired}
                      className="border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="">{`First timer?${star}`}</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                    <select
                      value={p.is_pwd === '' ? '' : p.is_pwd ? 'yes' : 'no'}
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          'is_pwd',
                          e.target.value === '' ? '' : e.target.value === 'yes'
                        )
                      }
                      required={fieldRequired}
                      className="border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="">{`PWD?${star}`}</option>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  {(parseInt(p.age, 10) >= 60 || p.is_senior) &&
                    (p.senior_id_url ? (
                      <p className="text-xs text-aegean-600 rounded-lg bg-aegean-50 px-3 py-2">
                        Senior ID on file —{' '}
                        <a
                          href={getAssetUrl(p.senior_id_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          View uploaded ID
                        </a>
                      </p>
                    ) : (
                      renderIdUpload(index, p, {
                        label:
                          'Senior citizen entrance rate (₱108) applies. Upload a valid senior citizen ID *',
                        fileField: 'senior_id_file',
                        file: p.senior_id_file,
                      })
                    ))}
                  {p.is_pwd === true &&
                    (p.pwd_id_url ? (
                      <p className="text-xs text-aegean-600 rounded-lg bg-aegean-50 px-3 py-2">
                        PWD ID on file —{' '}
                        <a
                          href={getAssetUrl(p.pwd_id_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          View uploaded ID
                        </a>
                      </p>
                    ) : (
                      renderIdUpload(index, p, {
                        label:
                          'PWD entrance rate (₱108) applies. Upload a valid PWD ID *',
                        fileField: 'pwd_id_file',
                        file: p.pwd_id_file,
                      })
                    ))}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addPassenger}
              className="mt-3 text-sm text-aegean-600 hover:text-aegean-800 flex items-center gap-1"
            >
              <Plus size={16} /> Add guest
              {data.passengers.length >= rates.maxPassengersPerBoat
                ? ' (extra boats added automatically for large groups)'
                : ''}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-aegean-800 mb-1">
              {`2. Address of passengers${star}`}
            </label>
            <textarea
              rows={2}
              value={data.passenger_address}
              onChange={(e) => update({ passenger_address: e.target.value })}
              required={fieldRequired}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-aegean-800">
              {`3. Name of payor with complete address and cellphone number${star}`}
            </p>
            <input
              type="text"
              placeholder={`Payor full name${star}`}
              value={data.payor_name}
              onChange={(e) => update({ payor_name: e.target.value })}
              required={fieldRequired}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
            <textarea
              rows={2}
              placeholder={`Complete address${star}`}
              value={data.payor_address}
              onChange={(e) => update({ payor_address: e.target.value })}
              required={fieldRequired}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
            <input
              type="tel"
              placeholder={`Cellphone number${star}`}
              value={data.payor_phone}
              onChange={(e) => update({ payor_phone: digitsOnly(e.target.value) })}
              inputMode="numeric"
              pattern="[0-9]*"
              required={fieldRequired}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-aegean-800">
              {`4. Name of contact person in case of emergency${star}`}
            </p>
            <p className="text-xs text-aegean-600 -mt-2">
              Must be someone who is not joining the tour.
            </p>
            <input
              type="text"
              placeholder={`Emergency contact name${star}`}
              value={data.emergency_contact_name}
              onChange={(e) => update({ emergency_contact_name: e.target.value })}
              required={fieldRequired}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-aegean-800 mb-1">
              {`5. Cellphone number of contact person in case of emergency${star}`}
            </label>
            <input
              type="tel"
              value={data.emergency_contact_phone}
              onChange={(e) => update({ emergency_contact_phone: digitsOnly(e.target.value) })}
              inputMode="numeric"
              pattern="[0-9]*"
              required={fieldRequired}
              className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>

          {quote && !quote.error && (
            <div className="rounded-xl border border-aegean-300 bg-white p-4 space-y-3">
              <p className="font-medium text-aegean-800">Island hopping computation</p>
              {quote.boat_label && (
                <p className="text-xs text-aegean-600">Boat: {quote.boat_label}</p>
              )}
              <ul className="text-sm space-y-2">
                {quote.breakdown.map((line, i) => (
                  <li key={i} className="flex justify-between gap-4 text-aegean-700">
                    <span className="flex-1">{line.description}</span>
                    <span className="shrink-0">₱{Number(line.subtotal).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-aegean-200 pt-3 font-semibold text-aegean-800">
                <span>Total tour</span>
                <span>₱{Number(quote.total).toLocaleString()}</span>
              </div>
              {!formComplete && (
                <p className="text-xs text-aegean-500">
                  Complete all fields above to include island hopping in your booking total.
                </p>
              )}
            </div>
          )}
          {quote?.error && <p className="text-sm text-red-600">{quote.error}</p>}
          </>
          )}

          {data.soa_summary && (
            <div className="rounded-xl border border-aegean-300 bg-white p-4">
              <p className="font-medium text-aegean-800">Island hopping summary</p>
              <p className="text-sm text-aegean-700 mt-2">
                {data.summary_pax || '—'} pax · ₱
                {Number(parseFloat(data.summary_amount) || 0).toLocaleString('en-PH', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-aegean-500 mt-2">
                This will appear on the SOA as one line with pax count and amount.
              </p>
              {summaryBoatPlan?.length > 0 && (
                <p className="text-xs text-aegean-600 mt-2">
                  Boats: {formatBoatPlanLabel(summaryBoatPlan)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
