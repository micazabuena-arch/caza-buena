import { useEffect, useState } from 'react';
import api, { getApiError } from '../api/client';
import { getAssetUrl } from '../utils/assetUrl';
import Loading from '../components/ui/Loading';
import UploadLabelButton from '../components/ui/UploadLabelButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Pagination from '../components/ui/Pagination';
import AdminListFilters from '../components/ui/AdminListFilters';
import { useFilteredPagination } from '../hooks/useAdminListFilter';

const GALLERY_SEARCH_FIELDS = ['title', 'category'];

export default function AdminGallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const {
    search,
    setSearch,
    filtered,
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems,
    from,
    to,
  } = useFilteredPagination(images, { searchFields: GALLERY_SEARCH_FIELDS });

  const load = () =>
    api
      .get('/gallery')
      .then((r) => setImages(Array.isArray(r.data) ? r.data : []))
      .catch(() => setImages([]))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await confirm({
      title: 'Upload photo?',
      message: 'Add this image to the website gallery?',
      confirmLabel: 'Yes, upload',
    });
    if (!ok) {
      e.target.value = '';
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append('image', file);
    try {
      await api.post('/gallery/admin', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
      toast.success('Image uploaded.');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    const ok = await confirm({
      title: 'Remove photo?',
      message: 'This image will be removed from the gallery.',
      confirmLabel: 'Yes, remove',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/gallery/admin/${id}`);
      setImages((prev) => prev.filter((i) => i.id !== id));
      toast.success('Image removed.');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-serif text-aegean-800">Gallery</h1>
        <UploadLabelButton
          loading={uploading}
          inputProps={{ accept: 'image/*', onChange: handleUpload }}
        >
          Upload Image
        </UploadLabelButton>
      </div>
      {images.length > 0 && (
        <AdminListFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search photo title or category…"
        />
      )}
      {loading ? (
        <Loading />
      ) : images.length === 0 ? (
        <p className="text-aegean-600 text-sm">No gallery photos yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-aegean-600 text-sm">No photos match this search.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pageItems.map((img) => (
            <div key={img.id} className="relative group rounded-xl overflow-hidden">
                <img src={getAssetUrl(img.image_url)} alt={img.title} className="w-full aspect-square object-cover" />
              <button
                type="button"
                onClick={() => remove(img.id)}
                className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {!loading && filtered.length > 0 && (
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
  );
}
