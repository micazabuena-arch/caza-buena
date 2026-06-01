import { useEffect, useState } from 'react';
import api from '../api/client';
import StaticPageLayout from '../components/layout/StaticPageLayout';
import PlaceholderImage from '../components/ui/PlaceholderImage';
import { GallerySkeleton } from '../components/ui/ContentSkeleton';
import { pages, images, galleryPlaceholders } from '../data/placeholders';

export default function Gallery() {
  const { gallery } = pages;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/gallery')
      .then((r) => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const usePlaceholder = !loading && items.length === 0;

  return (
    <StaticPageLayout hero={{ ...gallery, image: images.gallery }}>
      {loading ? (
        <GallerySkeleton />
      ) : usePlaceholder ? (
        <>
          <p className="text-center text-sm text-aegean-500 mb-8">
            Placeholder gallery — upload photos in Admin → Gallery
          </p>
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {gallery.items.map((item, i) => (
              <figure key={item.title} className="break-inside-avoid rounded-xl overflow-hidden shadow-md">
                <PlaceholderImage
                  src={galleryPlaceholders[i % galleryPlaceholders.length]}
                  alt={item.title}
                  aspect="aspect-[3/4]"
                  label={`${item.title} — add photo`}
                />
              </figure>
            ))}
          </div>
        </>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {items.map((img) => (
            <figure key={img.id} className="break-inside-avoid rounded-xl overflow-hidden shadow-md">
              <img src={img.image_url} alt={img.title || 'Caza Buena'} className="w-full" />
            </figure>
          ))}
        </div>
      )}
    </StaticPageLayout>
  );
}
