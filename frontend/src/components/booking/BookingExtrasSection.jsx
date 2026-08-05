import {
  BILAO_PACKAGES,
  BOODLE_FIGHT_PACKAGES,
  bilaoLinesFromQty,
  boodleLinesFromQty,
  emptyBilaoQty,
  emptyBoodleQty,
  maxPetsForRoomType,
  PET_DEPOSIT_PER_PET,
  summarizeBilaoLines,
  summarizeBoodleLines,
} from '../../data/bookingAddOns';
import { YesNoChoice } from './FormSection';

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

function FoodQtyTable({ packages, qtyMap, onQtyChange, paxColumn = false }) {
  const updateQty = (id, value) => {
    onQtyChange({ ...qtyMap, [id]: value });
  };

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-aegean-500">
            <th className="pb-2 pr-3 font-medium">Size</th>
            {paxColumn && <th className="pb-2 pr-3 font-medium">Good for</th>}
            <th className="pb-2 pr-3 font-medium">Price</th>
            <th className="pb-2 font-medium w-20">Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-aegean-100">
          {packages.map((pkg) => (
            <tr key={pkg.id}>
              <td className="py-2 pr-3 font-medium text-aegean-800">{pkg.label}</td>
              {paxColumn && <td className="py-2 pr-3 text-aegean-600">{pkg.pax} pax</td>}
              <td className="py-2 pr-3 text-aegean-600">₱{pkg.price.toLocaleString()}</td>
              <td className="py-2">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={qtyMap?.[pkg.id] ?? 0}
                  onChange={(e) => updateQty(pkg.id, e.target.value)}
                  className={`${inputClass} max-w-[4.5rem] text-center py-1.5`}
                  aria-label={`Quantity for ${pkg.label}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BookingExtrasSection({ data, onChange, roomType, foodRates }) {
  const update = (patch) => onChange({ ...data, ...patch });
  const maxPets = maxPetsForRoomType(roomType);
  const petCount = parseInt(data.pet_count, 10) || 0;
  const bilaoPackages = foodRates?.bilaoPackages || BILAO_PACKAGES;
  const boodlePackages = foodRates?.boodlePackages || BOODLE_FIGHT_PACKAGES;
  const petDepositPerPet = foodRates?.petDepositPerPet ?? PET_DEPOSIT_PER_PET;

  const bilaoQty = data.bilao_qty || emptyBilaoQty(bilaoPackages);
  const boodleQty = data.boodle_qty || emptyBoodleQty(boodlePackages);
  const bilaoSubtotal = data.bilao_enabled
    ? summarizeBilaoLines(bilaoLinesFromQty(bilaoQty, bilaoPackages), bilaoPackages).total
    : 0;
  const boodleSubtotal = data.boodle_fight_enabled
    ? summarizeBoodleLines(boodleLinesFromQty(boodleQty, boodlePackages), boodlePackages).total
    : 0;

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
              {petDepositPerPet.toLocaleString()} refundable deposit each
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
                Deposit on arrival: ₱{(petCount * petDepositPerPet).toLocaleString()} (refundable)
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
                Rice, drinks & utensils · enter quantity per size
              </p>
            </div>
            <YesNoChoice
              name="bilao"
              value={data.bilao_enabled}
              yesLabel="Add"
              onChange={(yes) =>
                update({
                  bilao_enabled: yes,
                  bilao_qty: yes ? bilaoQty : emptyBilaoQty(bilaoPackages),
                  bilao_package: '',
                })
              }
            />
          </div>
          {data.bilao_enabled && (
            <>
              <FoodQtyTable
                packages={bilaoPackages}
                qtyMap={bilaoQty}
                onQtyChange={(bilao_qty) => update({ bilao_qty })}
                paxColumn
              />
              {bilaoSubtotal > 0 && (
                <p className="text-xs font-medium text-aegean-700 pt-1">
                  Bilao subtotal: ₱{bilaoSubtotal.toLocaleString()}
                </p>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-aegean-100 bg-aegean-50/30 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-aegean-800">Boodle fight</p>
              <p className="text-xs text-aegean-500 mt-0.5">
                Filipino feast on banana leaves · enter quantity per group size
              </p>
            </div>
            <YesNoChoice
              name="boodle_fight"
              value={data.boodle_fight_enabled}
              yesLabel="Add"
              onChange={(yes) =>
                update({
                  boodle_fight_enabled: yes,
                  boodle_qty: yes ? boodleQty : emptyBoodleQty(boodlePackages),
                  boodle_fight_tier: '',
                })
              }
            />
          </div>
          {data.boodle_fight_enabled && (
            <>
              <FoodQtyTable
                packages={boodlePackages}
                qtyMap={boodleQty}
                onQtyChange={(boodle_qty) => update({ boodle_qty })}
              />
              {boodleSubtotal > 0 && (
                <p className="text-xs font-medium text-aegean-700 pt-1">
                  Boodle fight subtotal: ₱{boodleSubtotal.toLocaleString()}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
