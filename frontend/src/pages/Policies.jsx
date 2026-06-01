import { useEffect, useState } from 'react';
import api from '../api/client';
import StaticPageLayout from '../components/layout/StaticPageLayout';
import { ListSkeleton } from '../components/ui/ContentSkeleton';
import { pages, images } from '../data/placeholders';

export default function Policies() {
  const { policies } = pages;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/policies')
      .then((r) => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const display = items.length > 0 ? items : policies.items;

  return (
    <StaticPageLayout hero={{ ...policies, image: images.policies }}>
      <div className="max-w-3xl mx-auto">
        {loading ? (
          <ListSkeleton count={4} />
        ) : (
          <>
            {items.length === 0 && (
              <p className="text-center text-sm text-aegean-500 mb-8">Placeholder policies — edit in Admin → Policies</p>
            )}
            <div className="space-y-8">
              {display.map((policy, i) => (
                <article key={policy.id || i} className="pb-8 border-b border-aegean-100 last:border-0">
                  <h3 className="text-xl font-serif text-aegean-800 mb-3">{policy.title}</h3>
                  <p className="text-aegean-700/90 leading-relaxed whitespace-pre-line">{policy.content}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </StaticPageLayout>
  );
}
