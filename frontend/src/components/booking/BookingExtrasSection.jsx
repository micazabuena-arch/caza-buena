import {
  BILAO_PACKAGES,
  BOODLE_FIGHT_PACKAGES,
  maxPetsForRoomType,
  PET_DEPOSIT_PER_PET,
} from '../../data/bookingAddOns';
import { YesNoChoice } from './FormSection';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

export default function BookingExtrasSection({ data, onChange, roomType }) {
  const update = (patch) => onChange({ ...data, ...patch });
  const maxPets = maxPetsForRoomType(roomType);
  const petCount = parseInt(data.pet_count, 10) || 0;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-aegean-800">Bringing a car?</p>
            <p className="text-xs text-aegean-500 mt-0.5">For parking arrangements</p>
          </div>
          <YesNoChoice
            name="bringing_car"
            value={data.bringing_car}
            onChange={(yes) => update({ bringing_car: yes, car_count: yes ? data.car_count || 1 : 1 })}
          />
          {data.bringing_car && (
            <div>
              <label className="block text-xs font-medium text-aegean-600 mb-1">How many cars?</label>
              <input
                type="number"
                min={1}
                max={5}
                value={data.car_count}
                onChange={(e) => update({ car_count: e.target.value })}
                className={`${inputClass} max-w-[8rem]`}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-aegean-800">Bringing pets?</p>
            <p className="text-xs text-aegean-500 mt-0.5">
              Up to {maxPets} small–medium pet{maxPets !== 1 ? 's' : ''} · ₱
              {PET_DEPOSIT_PER_PET.toLocaleString()} refundable deposit each
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-aegean-600 mb-1">
              Number of pets
            </label>
            <input
              type="number"
              min={0}
              max={maxPets}
              value={data.pet_count}
              onChange={(e) => update({ pet_count: e.target.value })}
              className={`${inputClass} max-w-[8rem]`}
            />
            {petCount > maxPets && (
              <p className="text-xs text-red-600 mt-1">Maximum {maxPets} for this room.</p>
            )}
            {petCount > 0 && (
              <p className="text-xs text-aegean-600 mt-2">
                Deposit on arrival: ₱{(petCount * PET_DEPOSIT_PER_PET).toLocaleString()} (refundable)
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-aegean-100 pt-6 space-y-5">
        <p className="text-sm font-medium text-aegean-800">Food add-ons</p>

        <div className="rounded-xl border border-aegean-100 bg-aegean-50/30 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-aegean-800">Bilao food package</p>
              <p className="text-xs text-aegean-500 mt-0.5">
                Rice, drinks & utensils · from ₱1,500
              </p>
            </div>
            <YesNoChoice
              name="bilao"
              value={data.bilao_enabled}
              yesLabel="Add"
              onChange={(yes) =>
                update({ bilao_enabled: yes, bilao_package: yes ? data.bilao_package : '' })
              }
            />
          </div>
          {data.bilao_enabled && (
            <select
              value={data.bilao_package}
              onChange={(e) => update({ bilao_package: e.target.value })}
              className={inputClass}
            >
              <option value="">Choose package size…</option>
              {BILAO_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.label} — good for {pkg.pax} pax — ₱{pkg.price.toLocaleString()}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="rounded-xl border border-aegean-100 bg-aegean-50/30 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-aegean-800">Boodle fight</p>
              <p className="text-xs text-aegean-500 mt-0.5">
                Filipino feast on banana leaves · from ₱5,000
              </p>
            </div>
            <YesNoChoice
              name="boodle_fight"
              value={data.boodle_fight_enabled}
              yesLabel="Add"
              onChange={(yes) =>
                update({
                  boodle_fight_enabled: yes,
                  boodle_fight_tier: yes ? data.boodle_fight_tier : '',
                })
              }
            />
          </div>
          {data.boodle_fight_enabled && (
            <select
              value={data.boodle_fight_tier}
              onChange={(e) => update({ boodle_fight_tier: e.target.value })}
              className={inputClass}
            >
              <option value="">Choose group size…</option>
              {BOODLE_FIGHT_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.label} — ₱{pkg.price.toLocaleString()}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
