import { useEffect, useState } from 'react';
import { Plus, Pencil, Upload, Star, Trash2, CalendarRange } from 'lucide-react';
import IconActionButton, { IconActionGroup } from '../components/ui/IconActionButton';
import api, { getApiError } from '../api/client';
import { getAssetUrl } from '../utils/assetUrl';
import Loading from '../components/ui/Loading';
import SubmitButton from '../components/ui/SubmitButton';
import UploadLabelButton from '../components/ui/UploadLabelButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { ROOM_INVENTORY } from '../data/resortRules';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import AdminModal from '../components/admin/AdminModal';

const emptyForm = () => ({
  name: '',
  room_type: 'queen',
  slug: '',
  short_description: '',
  description: '',
  min_guests: 1,
  max_guests: 12,
  included_adults: 8,
  price_per_night: '',
  price_weekend: '',
  sort_order: 0,
  is_active: true,
  amenitiesText: '',
});

const emptyHolidayForm = () => ({
  label: '',
  start_date: '',
  end_date: '',
  price_per_night: '',
});

const formatPeso = (n) => `₱${Number(n || 0).toLocaleString()}`;

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const askConfirm = useConfirm();
  const [error, setError] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [holidayRates, setHolidayRates] = useState([]);
  const [newHoliday, setNewHoliday] = useState(emptyHolidayForm());
  const [holidaySaving, setHolidaySaving] = useState(false);
  const { page, setPage, pageItems, totalPages, totalItems, from, to } = usePagination(rooms);

  const loadRooms = () => {
    setLoading(true);
    api
      .get('/rooms/admin/all')
      .then((r) => setRooms(r.data))
      .catch((e) => setError(getApiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const openAdd = () => {
    setEditingId('new');
    setForm(emptyForm());
    setImages([]);
    setHolidayRates([]);
    setNewHoliday(emptyHolidayForm());
    setSlugManual(false);
    setError('');
  };

  const openEdit = (room) => {
    setEditingId(room.id);
    setForm({
      name: room.name || '',
      room_type: room.room_type || 'queen',
      slug: room.slug || '',
      short_description: room.short_description || '',
      description: room.description || '',
      min_guests: room.min_guests ?? 1,
      max_guests: room.max_guests ?? room.capacity ?? 2,
      included_adults: room.included_adults ?? room.max_guests ?? room.capacity ?? 2,
      price_per_night: room.price_per_night ?? '',
      price_weekend: room.price_weekend ?? room.price_per_night ?? '',
      sort_order: room.sort_order || 0,
      is_active: !!room.is_active,
      amenitiesText: (room.amenities || []).join(', '),
    });
    setImages(room.images || []);
    setHolidayRates(room.holiday_rates || []);
    setNewHoliday(emptyHolidayForm());
    setSlugManual(true);
    setError('');
  };

  const closeForm = () => {
    setEditingId(null);
    setError('');
  };

  const handleNameChange = (name) => {
    setForm((f) => ({
      ...f,
      name,
      slug: slugManual ? f.slug : slugify(name),
    }));
  };

  const parseAmenities = () =>
    form.amenitiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const policyMax = form.room_type === 'suite' ? 12 : 5;
    let maxGuests = parseInt(form.max_guests, 10) || policyMax;
    if (maxGuests > policyMax) maxGuests = policyMax;
    const minGuests = Math.min(parseInt(form.min_guests, 10) || 1, maxGuests);
    let includedAdults = parseInt(form.included_adults, 10) || 2;
    if (includedAdults > maxGuests) includedAdults = maxGuests;

    const payload = {
      name: form.name.trim(),
      room_type: form.room_type === 'suite' ? 'suite' : 'queen',
      slug: form.slug.trim(),
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      min_guests: minGuests,
      max_guests: maxGuests,
      capacity: maxGuests,
      included_adults: includedAdults,
      price_per_night: parseFloat(form.price_per_night),
      price_weekend: parseFloat(form.price_weekend || form.price_per_night),
      sort_order: parseInt(form.sort_order, 10) || 0,
      is_active: form.is_active,
      amenities: parseAmenities(),
    };

    if (!payload.name || !payload.slug) {
      setError('Name and slug are required');
      setSaving(false);
      return;
    }
    if (payload.min_guests > payload.max_guests) {
      setError('Minimum guests cannot be greater than maximum guests.');
      setSaving(false);
      return;
    }
    if (payload.max_guests > policyMax) {
      setError(
        `Maximum guests for ${payload.room_type === 'suite' ? 'Suite' : 'Queen'} cannot exceed ${policyMax} per resort policy.`
      );
      setSaving(false);
      return;
    }
    if (Number.isNaN(payload.price_per_night) || payload.price_per_night < 0) {
      setError('Enter a valid weekday price');
      setSaving(false);
      return;
    }
    if (Number.isNaN(payload.price_weekend) || payload.price_weekend < 0) {
      setError('Enter a valid weekend price');
      setSaving(false);
      return;
    }

    const ok = await askConfirm({
      title: editingId === 'new' ? 'Create room?' : 'Save room?',
      message:
        editingId === 'new'
          ? 'This room will be added to the website and available for booking.'
          : 'Your changes will be published on the website.',
      confirmLabel: editingId === 'new' ? 'Yes, create' : 'Yes, save',
    });
    if (!ok) {
      setSaving(false);
      return;
    }

    try {
      if (editingId === 'new') {
        await api.post('/admin/rooms', payload);
        toast.success('Room created.');
        closeForm();
        loadRooms();
      } else {
        await api.put(`/admin/rooms/${editingId}`, payload);
        loadRooms();
        setError('');
        toast.success('Room saved.');
      }
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || editingId === 'new') {
      if (editingId === 'new') setError('Save the room first, then upload images.');
      return;
    }
    const ok = await askConfirm({
      title: 'Upload photo?',
      message: 'Add this image to the room gallery?',
      confirmLabel: 'Yes, upload',
    });
    if (!ok) {
      e.target.value = '';
      return;
    }
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('image', file);
    fd.append('is_primary', images.length === 0 ? '1' : '0');
    try {
      const { data } = await api.post(`/admin/rooms/${editingId}/images`, fd);
      setImages((prev) => [...prev, { id: data.id, image_url: data.image_url, is_primary: data.is_primary }]);
      toast.success('Photo uploaded.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = async (imageId) => {
    const ok = await askConfirm({
      title: 'Remove photo?',
      message: 'This image will be removed from the room gallery.',
      confirmLabel: 'Yes, remove',
      variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/admin/rooms/${editingId}/images/${imageId}`);
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  };

  const setPrimaryImage = async (imageId) => {
    await api.patch(`/admin/rooms/${editingId}/images/${imageId}/primary`);
    setImages((prev) =>
      prev.map((i) => ({ ...i, is_primary: i.id === imageId ? 1 : 0 }))
    );
  };

  const addHolidayRate = async (e) => {
    e.preventDefault();
    if (editingId === 'new') {
      setError('Save the room first, then add holiday pricing.');
      return;
    }
    const price = parseFloat(newHoliday.price_per_night);
    if (!newHoliday.label.trim() || !newHoliday.start_date || !newHoliday.end_date || Number.isNaN(price)) {
      setError('Holiday label, dates, and price are required');
      return;
    }
    if (newHoliday.end_date < newHoliday.start_date) {
      setError('Holiday end date must be on or after start date');
      return;
    }
    const ok = await askConfirm({
      title: 'Add holiday pricing?',
      message: `Apply special rates for "${newHoliday.label.trim()}"?`,
      confirmLabel: 'Yes, add',
    });
    if (!ok) return;
    setHolidaySaving(true);
    setError('');
    try {
      const { data } = await api.post(`/admin/rooms/${editingId}/holidays`, {
        label: newHoliday.label.trim(),
        start_date: newHoliday.start_date,
        end_date: newHoliday.end_date,
        price_per_night: price,
      });
      setHolidayRates((prev) => [
        ...prev,
        {
          id: data.id,
          label: newHoliday.label.trim(),
          start_date: newHoliday.start_date,
          end_date: newHoliday.end_date,
          price_per_night: price,
        },
      ]);
      setNewHoliday(emptyHolidayForm());
      loadRooms();
      toast.success('Holiday pricing period added.');
    } catch (err) {
      const msg = getApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setHolidaySaving(false);
    }
  };

  const deleteRoom = async (room) => {
    const ok = await askConfirm({
      title: 'Delete room permanently?',
      message: `"${room.name}" will be removed. This only works if the room has no bookings — otherwise set it to Inactive.`,
      confirmLabel: 'Yes, delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/rooms/${room.id}`);
      toast.success('Room deleted.');
      if (editingId === room.id) closeForm();
      loadRooms();
    } catch (err) {
      const msg = getApiError(err);
      toast.error(msg);
    }
  };

  const removeHolidayRate = async (holidayId) => {
    const ok = await askConfirm({
      title: 'Remove holiday pricing?',
      message: 'This special rate period will be deleted.',
      confirmLabel: 'Yes, remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/rooms/${editingId}/holidays/${holidayId}`);
      setHolidayRates((prev) => prev.filter((h) => h.id !== holidayId));
      loadRooms();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-serif text-aegean-800">Rooms</h1>
        <button type="button" onClick={openAdd} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={18} /> Add Room
        </button>
      </div>

      <AdminModal
        open={Boolean(editingId)}
        onClose={closeForm}
        title={editingId === 'new' ? 'Add new room' : 'Edit room'}
        size="xl"
        padding={false}
        bodyClassName="p-6 md:p-8"
      >
          {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">{error}</p>}

          <form id="room-edit-form" onSubmit={handleSave} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">Room Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full border border-aegean-200 rounded-lg px-4 py-2.5"
                  placeholder="Aegean Suite"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">URL Slug *</label>
                <input
                  required
                  value={form.slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setForm((f) => ({ ...f, slug: e.target.value }));
                  }}
                  className="w-full border border-aegean-200 rounded-lg px-4 py-2.5 font-mono text-sm"
                  placeholder="aegean-suite"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-aegean-700 mb-1">Short Description</label>
              <input
                value={form.short_description}
                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
                className="w-full border border-aegean-200 rounded-lg px-4 py-2.5"
                placeholder="One line summary for listings"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-aegean-700 mb-1">Full Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-aegean-200 rounded-lg px-4 py-2.5"
                placeholder="Detailed room description for the room page"
              />
            </div>

            <div className="rounded-xl border border-aegean-100 bg-aegean-50/40 p-4">
              <p className="text-sm font-medium text-aegean-800 mb-3">Nightly rates</p>
              <p className="text-xs text-aegean-600 mb-4">
                Weekday = Mon–Thu · Weekend = Fri–Sun · Holiday periods override both for those dates
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-aegean-700 mb-1">Weekday (Mon–Thu) ₱ *</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    value={form.price_per_night}
                    onChange={(e) => setForm((f) => ({ ...f, price_per_night: e.target.value }))}
                    className="w-full border border-aegean-200 rounded-lg px-4 py-2.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-aegean-700 mb-1">Weekend (Fri–Sun) ₱ *</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    value={form.price_weekend}
                    onChange={(e) => setForm((f) => ({ ...f, price_weekend: e.target.value }))}
                    className="w-full border border-aegean-200 rounded-lg px-4 py-2.5 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">Room type</label>
                <select
                  value={form.room_type}
                  onChange={(e) => {
                    const room_type = e.target.value;
                    setForm((f) => ({
                      ...f,
                      room_type,
                      ...(editingId === 'new'
                        ? {
                            min_guests: 1,
                            max_guests: room_type === 'suite' ? 12 : 5,
                            included_adults: room_type === 'suite' ? 8 : 2,
                          }
                        : {}),
                    }));
                  }}
                  className="w-full border border-aegean-200 rounded-lg px-4 py-2.5 bg-white"
                >
                  <option value="suite">Suite (2 bedrooms)</option>
                  <option value="queen">Queen (1 bedroom)</option>
                </select>
                <p className="text-xs text-aegean-500 mt-1">Suite units have 2 bedrooms; Queen units have 1 bedroom.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">Minimum guests</label>
                <input
                  type="number"
                  min={1}
                  value={form.min_guests}
                  onChange={(e) => setForm((f) => ({ ...f, min_guests: e.target.value }))}
                  className="w-full border border-aegean-200 rounded-lg px-4 py-2.5"
                />
                <p className="text-xs text-aegean-500 mt-1">Lowest headcount allowed per booking.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">Maximum guests</label>
                <input
                  type="number"
                  min={1}
                  value={form.max_guests}
                  onChange={(e) => setForm((f) => ({ ...f, max_guests: e.target.value }))}
                  className="w-full border border-aegean-200 rounded-lg px-4 py-2.5"
                />
                <p className="text-xs text-aegean-500 mt-1">
                  Optional cap per unit (cannot exceed room-type policy below).
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-aegean-200 bg-aegean-50/50 p-4 text-sm text-aegean-800">
              <p className="font-medium mb-1">
                Maximum guests policy — {form.room_type === 'suite' ? 'Suite' : 'Queen'}
              </p>
              <p className="text-aegean-600 text-xs leading-relaxed">
                {ROOM_INVENTORY[form.room_type === 'suite' ? 'suite' : 'queen']?.capacityNote}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">
                  Adults in base rate
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.included_adults}
                  onChange={(e) => setForm((f) => ({ ...f, included_adults: e.target.value }))}
                  className="w-full border border-aegean-200 rounded-lg px-4 py-2.5"
                />
                <p className="text-xs text-aegean-500 mt-1">
                  Extra adult ₱800/night applies above this count. Child 7–12 ₱400/night each.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-aegean-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  className="w-full border border-aegean-200 rounded-lg px-4 py-2.5"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-aegean-700">Active (visible on website)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-aegean-700 mb-1">Amenities</label>
              <input
                value={form.amenitiesText}
                onChange={(e) => setForm((f) => ({ ...f, amenitiesText: e.target.value }))}
                className="w-full border border-aegean-200 rounded-lg px-4 py-2.5"
                placeholder="King bed, Air conditioning, Private terrace (comma-separated)"
              />
            </div>
          </form>

          {editingId !== 'new' && (
            <div className="mt-8 pt-8 border-t border-aegean-100">
              <h3 className="font-medium text-aegean-800 mb-2 flex items-center gap-2">
                <CalendarRange size={18} /> Holiday & peak pricing
              </h3>
              <p className="text-xs text-aegean-600 mb-4">
                Set special rates for date ranges (e.g. Christmas, long weekends). These override weekday and weekend rates.
              </p>
              {holidayRates.length > 0 ? (
                <ul className="space-y-2 mb-4">
                  {holidayRates.map((h) => (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-aegean-50 rounded-lg px-4 py-3 text-sm"
                    >
                      <div>
                        <span className="font-medium text-aegean-800">{h.label}</span>
                        <span className="text-aegean-600 ml-2">
                          {h.start_date} → {h.end_date} · {formatPeso(h.price_per_night)}/night
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeHolidayRate(h.id)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-aegean-500 mb-4">No holiday periods yet.</p>
              )}
              <form onSubmit={addHolidayRate} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-aegean-700 mb-1">Label</label>
                  <input
                    value={newHoliday.label}
                    onChange={(e) => setNewHoliday((h) => ({ ...h, label: e.target.value }))}
                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Christmas & New Year"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-aegean-700 mb-1">Start</label>
                  <input
                    type="date"
                    value={newHoliday.start_date}
                    onChange={(e) => setNewHoliday((h) => ({ ...h, start_date: e.target.value }))}
                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-aegean-700 mb-1">End</label>
                  <input
                    type="date"
                    value={newHoliday.end_date}
                    onChange={(e) => setNewHoliday((h) => ({ ...h, end_date: e.target.value }))}
                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-aegean-700 mb-1">₱ / night</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={newHoliday.price_per_night}
                    onChange={(e) => setNewHoliday((h) => ({ ...h, price_per_night: e.target.value }))}
                    className="w-full border border-aegean-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <SubmitButton
                  loading={holidaySaving}
                  loadingLabel="Adding..."
                  variant="outline"
                  className="text-sm py-2"
                >
                  Add period
                </SubmitButton>
              </form>
            </div>
          )}

          {editingId !== 'new' && (
            <div className="mt-8 pt-8 border-t border-aegean-100">
              <h3 className="font-medium text-aegean-800 mb-4 flex items-center gap-2">
                <Upload size={18} /> Room Photos
              </h3>
              <div className="flex flex-wrap gap-4 mb-4">
                {images.map((img) => (
                  <div key={img.id} className="relative w-28 h-28 rounded-lg overflow-hidden border border-aegean-200 group">
                    <img src={getAssetUrl(img.image_url)} alt="" className="w-full h-full object-cover" />
                    {img.is_primary ? (
                      <span className="absolute top-1 left-1 bg-aegean-600 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Star size={10} fill="currentColor" /> Primary
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(img.id)}
                        className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100"
                      >
                        Set primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute bottom-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <UploadLabelButton
                variant="outline"
                loading={uploading}
                className="text-sm"
                inputProps={{ accept: 'image/*', onChange: handleImageUpload }}
              >
                <span className="inline-flex items-center gap-2">
                  <Upload size={16} /> Upload Photo
                </span>
              </UploadLabelButton>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-8 mt-8 border-t border-aegean-100">
            <SubmitButton
              form="room-edit-form"
              loading={saving}
              loadingLabel="Saving..."
              className="text-sm"
            >
              {editingId === 'new' ? 'Create Room' : 'Save Changes'}
            </SubmitButton>
            <button type="button" onClick={closeForm} className="btn-outline text-sm">
              Cancel
            </button>
            {editingId !== 'new' && (
              <button
                type="button"
                onClick={() => {
                  const room = rooms.find((r) => r.id === editingId);
                  if (room) deleteRoom(room);
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm text-red-600 border-2 border-red-300 rounded-full font-medium transition-all hover:bg-red-50 ml-auto"
              >
                Delete room
              </button>
            )}
          </div>
      </AdminModal>

      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-4">
          {rooms.length === 0 ? (
            <p className="text-aegean-600 text-center py-12 bg-white rounded-xl">No rooms yet. Click Add Room to create one.</p>
          ) : (
            pageItems.map((room) => (
              <div
                key={room.id}
                className="bg-white p-5 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {room.images?.[0] ? (
                    <img
                      src={getAssetUrl(room.images[0].image_url)}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-aegean-100 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-medium text-lg text-aegean-800 truncate">{room.name}</h3>
                    <p className="text-aegean-600 text-sm">
                      Weekday {formatPeso(room.price_per_night)} · Weekend{' '}
                      {formatPeso(room.price_weekend ?? room.price_per_night)} ·{' '}
                      {room.min_guests ?? 1}–{room.max_guests ?? room.capacity} guests
                    </p>
                    {(room.holiday_rates?.length ?? 0) > 0 && (
                      <p className="text-aegean-500 text-xs mt-0.5">
                        {room.holiday_rates.length} holiday period
                        {room.holiday_rates.length !== 1 ? 's' : ''}
                        {room.holiday_rates[0]?.label
                          ? ` · next: ${room.holiday_rates[0].label} (${formatPeso(room.holiday_rates[0].price_per_night)}/night)`
                          : ''}
                      </p>
                    )}
                    <p className="text-aegean-400 text-xs font-mono truncate">/{room.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      room.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {room.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <IconActionGroup>
                    <IconActionButton
                      icon={Pencil}
                      label="Edit room"
                      onClick={() => openEdit(room)}
                    />
                    <IconActionButton
                      icon={Trash2}
                      label="Delete room"
                      onClick={() => deleteRoom(room)}
                      className="hover:border-red-200 hover:text-red-600 hover:bg-red-50"
                    />
                  </IconActionGroup>
                </div>
              </div>
            ))
          )}
          {rooms.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              from={from}
              to={to}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
