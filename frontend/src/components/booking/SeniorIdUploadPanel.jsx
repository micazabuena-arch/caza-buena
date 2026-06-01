import { useState } from 'react';
import { Upload, CheckCircle } from 'lucide-react';
import api, { getApiError } from '../../api/client';
import ButtonSpinner from '../ui/ButtonSpinner';
import { useToast } from '../../context/ToastContext';
import { isSeniorPassenger } from '../../data/islandHoppingRates';
import { getAssetUrl } from '../../utils/assetUrl';

/**
 * Lets guests upload senior citizen IDs on the booking confirmation page
 * for island hopping passengers who qualify for the senior rate.
 */
export default function SeniorIdUploadPanel({ reference, islandHop, onUpdated }) {
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();

  if (!islandHop?.passengers?.length) return null;

  const seniors = islandHop.passengers
    .map((p, index) => ({ passenger: p, index }))
    .filter(({ passenger }) => isSeniorPassenger(passenger));

  if (seniors.length === 0) return null;

  const handleUpload = async (index, file) => {
    if (!file) return;
    setError('');
    setUploadingIndex(index);
    const formData = new FormData();
    formData.append('id', file);
    formData.append('passenger_index', String(index));

    try {
      const { data } = await api.post(`/bookings/${reference}/senior-id`, formData);
      onUpdated?.(index, data.senior_id_url);
      toast.success('Senior citizen ID uploaded.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setUploadingIndex(null);
    }
  };

  const allUploaded = seniors.every(({ passenger }) => passenger.senior_id_url);

  return (
    <div className="bg-white p-6 rounded-2xl border border-aegean-100 space-y-4 shadow-sm mt-6">
      <h4 className="font-medium flex items-center gap-2 text-aegean-800">
        <Upload size={18} /> Senior citizen ID (island hopping)
      </h4>
      <p className="text-xs text-aegean-600">
        Guests aged 60+ need a valid senior citizen ID to verify the discounted entrance fee.
        Upload a clear photo or scan (JPG, PNG, WebP, or PDF — max 10MB).
      </p>

      {allUploaded && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3">
          <CheckCircle size={16} /> All senior citizen IDs received. Thank you!
        </div>
      )}

      <ul className="space-y-4">
        {seniors.map(({ passenger, index }) => (
          <li key={index} className="rounded-lg border border-aegean-100 p-4 space-y-2">
            <p className="text-sm font-medium text-aegean-800">
              {passenger.full_name} <span className="text-aegean-500 font-normal">(age {passenger.age})</span>
            </p>
            {passenger.senior_id_url ? (
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={getAssetUrl(passenger.senior_id_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-aegean-600 underline"
                >
                  View uploaded ID →
                </a>
                <label className="text-xs text-aegean-500 cursor-pointer hover:text-aegean-700">
                  Replace file
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={uploadingIndex === index}
                    onChange={(e) => {
                      handleUpload(index, e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={uploadingIndex === index}
                  onChange={(e) => {
                    handleUpload(index, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="w-full text-sm border border-aegean-200 rounded-lg p-2"
                />
                {uploadingIndex === index && (
                  <p className="text-xs text-aegean-600 mt-1 flex items-center gap-2 font-medium">
                    <ButtonSpinner className="w-4 h-4" variant="primary" /> Uploading...
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
