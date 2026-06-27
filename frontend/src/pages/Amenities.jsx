import { useEffect, useState } from 'react';
import api from '../api/client';
import StaticPageLayout from '../components/layout/StaticPageLayout';
import { CardSkeleton } from '../components/ui/ContentSkeleton';
import { pages, images } from '../data/placeholders';
import { getAmenityIcon } from '../utils/amenityIcons';

export default function Amenities() {
  const { amenities } = pages;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/amenities')
      .then((r) => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Prefer the richer curated fallback list when API data is incomplete/outdated.
  const display =
    items.length > 0 && items.length >= amenities.items.length
      ? items
      : amenities.items;

  return (
    <StaticPageLayout hero={{ ...amenities, image: images.amenities }} className="bg-aegean-50">
      {loading ? (
        <CardSkeleton count={6} />
      ) : (
        <>
          {items.length === 0 && (
            <p className="text-center text-sm text-aegean-500 mb-8">
              Showing fallback amenities list while API data is unavailable.
            </p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {display.map((item, i) => {
              const Icon = getAmenityIcon(item.icon);
              return (
                <div key={item.id || i} className="bg-white p-8 rounded-2xl shadow-sm">
                  <Icon className="w-8 h-8 text-aegean-500 mb-4" />
                  <h3 className="text-xl text-aegean-800 mb-2">{item.title}</h3>
                  <p className="text-aegean-600/80">{item.description}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </StaticPageLayout>
  );
}
