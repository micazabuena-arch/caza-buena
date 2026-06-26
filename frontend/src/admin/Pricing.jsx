import { useEffect, useState } from 'react';
import api, { getApiError } from '../api/client';
import { useToast } from '../context/ToastContext';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import { EXTRA_PERSON_RATES } from '../data/resortRules';

const EXTRA_PAX_KEYS = {
  adult_weekday: 'extra_pax_adult_weekday',
  adult_weekend: 'extra_pax_adult_weekend',
  child_7_12: 'extra_pax_child_7_12',
};

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

/** Admin booking rates — extra guest fees and related pricing (expand here later). */
export default function AdminPricing() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [extraRatesForm, setExtraRatesForm] = useState(() => extraRatesFromSettings());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/settings')
      .then((r) => setExtraRatesForm(extraRatesFromSettings(r.data)))
      .catch((e) => setError(getApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const weekday = parseFloat(extraRatesForm.adult_weekday);
    const weekend = parseFloat(extraRatesForm.adult_weekend);
    const child = parseFloat(extraRatesForm.child_7_12);

    if (![weekday, weekend, child].every((n) => Number.isFinite(n) && n >= 0)) {
      setError('Enter valid amounts (0 or greater) for all rates.');
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

  if (loading) return <Loading />;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif text-aegean-800">Pricing</h1>
        <p className="text-sm text-aegean-600 mt-1">
          Booking rates used on the website and admin manual bookings.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <section className="bg-white rounded-2xl border border-aegean-100 shadow-sm p-6">
        <div className="mb-6">
          <h2 className="font-medium text-aegean-800">Extra guest rates</h2>
          <p className="text-sm text-aegean-600 mt-1">
            Per-night fees when guests exceed the adults included in the room package. Weekday is
            Mon–Thu; weekend is Fri–Sun (same as room rates).
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <div>
            <FieldLabel required>Extra adult — weekday</FieldLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aegean-500 text-sm">
                ₱
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={extraRatesForm.adult_weekday}
                onChange={(e) =>
                  setExtraRatesForm((f) => ({ ...f, adult_weekday: e.target.value }))
                }
                required
                className={`${inputClass} pl-8`}
              />
            </div>
            <p className="text-xs text-aegean-500 mt-1">Per extra adult, per weekday night</p>
          </div>
          <div>
            <FieldLabel required>Extra adult — weekend</FieldLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aegean-500 text-sm">
                ₱
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={extraRatesForm.adult_weekend}
                onChange={(e) =>
                  setExtraRatesForm((f) => ({ ...f, adult_weekend: e.target.value }))
                }
                required
                className={`${inputClass} pl-8`}
              />
            </div>
            <p className="text-xs text-aegean-500 mt-1">Per extra adult, per weekend night</p>
          </div>
          <div>
            <FieldLabel required>Child 7–12 years</FieldLabel>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aegean-500 text-sm">
                ₱
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={extraRatesForm.child_7_12}
                onChange={(e) =>
                  setExtraRatesForm((f) => ({ ...f, child_7_12: e.target.value }))
                }
                required
                className={`${inputClass} pl-8`}
              />
            </div>
            <p className="text-xs text-aegean-500 mt-1">
              Per child (7–12), per night · children 6 & below are free
            </p>
          </div>
          <SubmitButton loading={saving} loadingLabel="Saving...">
            Save rates
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
