import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import { EXTRA_PERSON_RATES } from '../data/resortRules';
import { ISLAND_HOPPING_RATES } from '../data/islandHoppingRates';
import { BILAO_PACKAGES, BOODLE_FIGHT_PACKAGES, PET_DEPOSIT_PER_PET } from '../data/bookingAddOns';
import {
  ISLAND_HOPPING_RATES_SETTING_KEY,
  islandHoppingRatesFromSettings,
  resolveIslandHoppingRates,
} from '../utils/islandHoppingRatesConfig';
import {
  FOOD_ADD_ON_RATES_SETTING_KEY,
  foodAddOnRatesFormState,
  foodAddOnRatesFromSettings,
  foodAddOnRatesToPayload,
} from '../utils/foodAddOnRatesConfig';

const EXTRA_PAX_KEYS = {
  adult_weekday: 'extra_pax_adult_weekday',
  adult_weekend: 'extra_pax_adult_weekend',
  child_7_12: 'extra_pax_child_7_12',
};

const PRICING_TABS = [
  { id: 'extra_guest', label: 'Extra guest rates' },
  { id: 'island_hopping', label: 'Island hopping' },
  { id: 'food_addons', label: 'Food add-ons' },
  { id: 'pet_deposit', label: 'Pet deposit' },
];

const inputClass =
  'w-full border border-aegean-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-aegean-400 outline-none bg-white';

function FieldLabel({ children, required }) {
  return (
    <span className="block text-sm font-medium text-aegean-700 mb-1.5">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
}

function MoneyInput({ value, onChange, required = true }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aegean-500 text-sm">₱</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={onChange}
        required={required}
        className={`${inputClass} pl-8`}
      />
    </div>
  );
}

function extraRatesFromSettings(settings) {
  return {
    adult_weekday:
      settings?.[EXTRA_PAX_KEYS.adult_weekday] ?? String(EXTRA_PERSON_RATES.adult_weekday),
    adult_weekend:
      settings?.[EXTRA_PAX_KEYS.adult_weekend] ?? String(EXTRA_PERSON_RATES.adult_weekend),
    child_7_12:
      settings?.[EXTRA_PAX_KEYS.child_7_12] ?? String(EXTRA_PERSON_RATES.child_7_12),
  };
}

/** Admin pricing — extra guest fees and Hundred Islands hopping rates. */
export default function AdminPricing() {
  const { isFullAdmin } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('extra_guest');
  const [loading, setLoading] = useState(true);
  const [extraRatesForm, setExtraRatesForm] = useState(() => extraRatesFromSettings());
  const [islandRatesForm, setIslandRatesForm] = useState(() =>
    structuredClone(ISLAND_HOPPING_RATES)
  );
  const [foodRatesForm, setFoodRatesForm] = useState(() => ({
    bilao: BILAO_PACKAGES.map((pkg) => ({ ...pkg })),
    boodle: BOODLE_FIGHT_PACKAGES.map((pkg) => ({ ...pkg })),
    petDepositPerPet: PET_DEPOSIT_PER_PET,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadPricingSettings = () =>
    api
      .get('/admin/settings')
      .then((r) => {
        setExtraRatesForm(extraRatesFromSettings(r.data));
        setIslandRatesForm(islandHoppingRatesFromSettings(r.data));
        setFoodRatesForm(foodAddOnRatesFormState(foodAddOnRatesFromSettings(r.data)));
      })
      .catch((e) => setError(getApiError(e)))
      .finally(() => setLoading(false));

  useEffect(() => {
    if (!isFullAdmin) return;
    loadPricingSettings();
  }, [isFullAdmin]);

  if (!isFullAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const patchEntrance = (key, rate) => {
    setIslandRatesForm((prev) => ({
      ...prev,
      entrance: {
        ...prev.entrance,
        [key]: { ...prev.entrance[key], rate },
      },
    }));
  };

  const patchBoatRate = (boatId, rate) => {
    setIslandRatesForm((prev) => ({
      ...prev,
      boat: prev.boat.map((row) => (row.id === boatId ? { ...row, rate } : row)),
    }));
  };

  const handleSaveExtraGuest = async (e) => {
    e.preventDefault();
    setError('');

    const weekday = parseFloat(extraRatesForm.adult_weekday);
    const weekend = parseFloat(extraRatesForm.adult_weekend);
    const child = parseFloat(extraRatesForm.child_7_12);

    if (![weekday, weekend, child].every((n) => Number.isFinite(n) && n >= 0)) {
      setError('Enter valid amounts (0 or greater) for all extra guest rates.');
      return;
    }

    setSaving(true);
    try {
      await api.put('/admin/settings', {
        [EXTRA_PAX_KEYS.adult_weekday]: String(weekday),
        [EXTRA_PAX_KEYS.adult_weekend]: String(weekend),
        [EXTRA_PAX_KEYS.child_7_12]: String(child),
      });
      toast.success('Extra guest rates saved.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const patchBilaoPrice = (id, price) => {
    setFoodRatesForm((prev) => ({
      ...prev,
      bilao: prev.bilao.map((row) => (row.id === id ? { ...row, price } : row)),
    }));
  };

  const patchBoodlePrice = (id, price) => {
    setFoodRatesForm((prev) => ({
      ...prev,
      boodle: prev.boodle.map((row) => (row.id === id ? { ...row, price } : row)),
    }));
  };

  const handleSaveFoodAddOns = async (e) => {
    e.preventDefault();
    setError('');

    const payload = foodAddOnRatesToPayload(foodRatesForm);
    setSaving(true);
    try {
      await api.put('/admin/settings', {
        [FOOD_ADD_ON_RATES_SETTING_KEY]: payload,
      });
      await loadPricingSettings();
      toast.success('Food add-on rates saved.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePetDeposit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = foodAddOnRatesToPayload(foodRatesForm);
    setSaving(true);
    try {
      await api.put('/admin/settings', {
        [FOOD_ADD_ON_RATES_SETTING_KEY]: payload,
      });
      await loadPricingSettings();
      toast.success('Pet deposit saved.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIslandHopping = async (e) => {
    e.preventDefault();
    setError('');

    const normalized = resolveIslandHoppingRates(islandRatesForm);
    setSaving(true);
    try {
      await api.put('/admin/settings', {
        [ISLAND_HOPPING_RATES_SETTING_KEY]: normalized,
      });
      await loadPricingSettings();
      toast.success('Island hopping rates saved.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif text-aegean-800">Pricing</h1>
        <p className="text-sm text-aegean-600 mt-1">
          Manage booking rates used on the website, quotations, and admin bookings.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-aegean-100 pb-1">
        {PRICING_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-aegean-600 text-aegean-800 bg-white'
                : 'border-transparent text-aegean-500 hover:text-aegean-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {activeTab === 'extra_guest' && (
        <section className="bg-white rounded-2xl border border-aegean-100 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="font-medium text-aegean-800">Extra guest rates</h2>
            <p className="text-sm text-aegean-600 mt-1">
              Per-night fees when guests exceed the adults included in the room package. Weekday is
              Mon–Thu; weekend is Fri–Sun.
            </p>
          </div>

          <form onSubmit={handleSaveExtraGuest} className="space-y-4 max-w-md">
            <div>
              <FieldLabel required>Extra adult — weekday</FieldLabel>
              <MoneyInput
                value={extraRatesForm.adult_weekday}
                onChange={(e) =>
                  setExtraRatesForm((f) => ({ ...f, adult_weekday: e.target.value }))
                }
              />
            </div>
            <div>
              <FieldLabel required>Extra adult — weekend</FieldLabel>
              <MoneyInput
                value={extraRatesForm.adult_weekend}
                onChange={(e) =>
                  setExtraRatesForm((f) => ({ ...f, adult_weekend: e.target.value }))
                }
              />
            </div>
            <div>
              <FieldLabel required>Child 7–12 years</FieldLabel>
              <MoneyInput
                value={extraRatesForm.child_7_12}
                onChange={(e) =>
                  setExtraRatesForm((f) => ({ ...f, child_7_12: e.target.value }))
                }
              />
              <p className="text-xs text-aegean-500 mt-1">Children 6 & below are free</p>
            </div>
            <SubmitButton loading={saving} loadingLabel="Saving...">
              Save extra guest rates
            </SubmitButton>
          </form>
        </section>
      )}

      {activeTab === 'island_hopping' && (
        <section className="bg-white rounded-2xl border border-aegean-100 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="font-medium text-aegean-800">Hundred Islands hopping</h2>
            <p className="text-sm text-aegean-600 mt-1">
              Entrance fees, boat tiers, and tour fees used on bookings, quotations, and island
              hopping forms. Changes apply to new calculations immediately.
            </p>
          </div>

          <form onSubmit={handleSaveIslandHopping} className="space-y-8">
            <div>
              <h3 className="text-sm font-medium text-aegean-800 mb-3">Entrance fees (per person)</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>Infant (0–4)</FieldLabel>
                  <MoneyInput
                    value={islandRatesForm.entrance.infant.rate}
                    onChange={(e) => patchEntrance('infant', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel required>Regular (5–59)</FieldLabel>
                  <MoneyInput
                    value={islandRatesForm.entrance.regular.rate}
                    onChange={(e) => patchEntrance('regular', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel required>Senior / PWD (discounted)</FieldLabel>
                  <MoneyInput
                    value={islandRatesForm.entrance.senior.rate}
                    onChange={(e) => patchEntrance('senior', e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel required>PWD rate</FieldLabel>
                  <MoneyInput
                    value={islandRatesForm.entrance.pwd.rate}
                    onChange={(e) => patchEntrance('pwd', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-aegean-800 mb-3">Motorboat rental (per boat)</h3>
              <div className="space-y-3">
                {islandRatesForm.boat.map((boat) => (
                  <div
                    key={boat.id}
                    className="grid sm:grid-cols-[1fr_160px] gap-3 items-end border border-aegean-100 rounded-lg p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-aegean-800">{boat.label}</p>
                      <p className="text-xs text-aegean-500">
                        {boat.min}–{boat.max} passengers per boat
                      </p>
                    </div>
                    <div>
                      <FieldLabel required>Rate</FieldLabel>
                      <MoneyInput
                        value={boat.rate}
                        onChange={(e) => patchBoatRate(boat.id, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-aegean-800 mb-3">Tour fees</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <FieldLabel required>Facilitation (standard boat)</FieldLabel>
                  <MoneyInput
                    value={islandRatesForm.facilitationFee}
                    onChange={(e) =>
                      setIslandRatesForm((prev) => ({
                        ...prev,
                        facilitationFee: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel required>Facilitation (Deluxe / multiple boats)</FieldLabel>
                  <MoneyInput
                    value={islandRatesForm.deluxeFacilitationFee}
                    onChange={(e) =>
                      setIslandRatesForm((prev) => ({
                        ...prev,
                        deluxeFacilitationFee: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <FieldLabel required>Garbage fee (per boat, refundable)</FieldLabel>
                  <MoneyInput
                    value={islandRatesForm.garbageFee}
                    onChange={(e) =>
                      setIslandRatesForm((prev) => ({ ...prev, garbageFee: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <SubmitButton loading={saving} loadingLabel="Saving...">
              Save island hopping rates
            </SubmitButton>
          </form>
        </section>
      )}

      {activeTab === 'food_addons' && (
        <section className="bg-white rounded-2xl border border-aegean-100 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="font-medium text-aegean-800">Food add-ons</h2>
            <p className="text-sm text-aegean-600 mt-1">
              Seafood bilao and boodle fight rates used on bookings, quotations, and the public
              booking form.
            </p>
          </div>

          <form onSubmit={handleSaveFoodAddOns} className="space-y-8">
            <div>
              <h3 className="text-sm font-medium text-aegean-800 mb-3">Seafood bilao (per tray)</h3>
              <div className="space-y-3">
                {foodRatesForm.bilao.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="grid sm:grid-cols-[1fr_120px_160px] gap-3 items-end border border-aegean-100 rounded-lg p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-aegean-800">{pkg.label}</p>
                      <p className="text-xs text-aegean-500">Good for {pkg.pax} pax</p>
                    </div>
                    <div>
                      <FieldLabel required>Pax</FieldLabel>
                      <input
                        type="number"
                        min={1}
                        value={pkg.pax}
                        readOnly
                        className={`${inputClass} bg-aegean-50 text-aegean-500`}
                      />
                    </div>
                    <div>
                      <FieldLabel required>Price</FieldLabel>
                      <MoneyInput
                        value={pkg.price}
                        onChange={(e) => patchBilaoPrice(pkg.id, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-aegean-800 mb-3">Boodle fight (per set)</h3>
              <div className="space-y-3">
                {foodRatesForm.boodle.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="grid sm:grid-cols-[1fr_160px] gap-3 items-end border border-aegean-100 rounded-lg p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-aegean-800">{pkg.label}</p>
                    </div>
                    <div>
                      <FieldLabel required>Price</FieldLabel>
                      <MoneyInput
                        value={pkg.price}
                        onChange={(e) => patchBoodlePrice(pkg.id, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <SubmitButton loading={saving} loadingLabel="Saving...">
              Save food add-on rates
            </SubmitButton>
          </form>
        </section>
      )}

      {activeTab === 'pet_deposit' && (
        <section className="bg-white rounded-2xl border border-aegean-100 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="font-medium text-aegean-800">Pet deposit</h2>
            <p className="text-sm text-aegean-600 mt-1">
              Refundable deposit charged per pet on the booking form. Queen rooms allow 1 pet;
              suites allow up to 2.
            </p>
          </div>

          <form onSubmit={handleSavePetDeposit} className="space-y-4 max-w-md">
            <div>
              <FieldLabel required>Deposit per pet</FieldLabel>
              <MoneyInput
                value={foodRatesForm.petDepositPerPet}
                onChange={(e) =>
                  setFoodRatesForm((prev) => ({ ...prev, petDepositPerPet: e.target.value }))
                }
              />
              <p className="text-xs text-aegean-500 mt-1">
                Collected on arrival and refunded when the pet leaves without damage.
              </p>
            </div>
            <SubmitButton loading={saving} loadingLabel="Saving...">
              Save pet deposit
            </SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}
