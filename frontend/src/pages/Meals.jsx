import { useEffect, useMemo, useState } from 'react';
import { Coffee, Download, UtensilsCrossed } from 'lucide-react';
import StaticPageLayout from '../components/layout/StaticPageLayout';
import Loading from '../components/ui/Loading';
import api from '../api/client';
import { pages, images } from '../data/placeholders';

const formatPrice = (price) =>
  price != null && !Number.isNaN(Number(price))
    ? `₱${Number(price).toLocaleString()}`
    : null;

function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const cat = item.category || 'Menu';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }
  return [...groups.entries()];
}

function MenuItemRow({ item }) {
  const price = formatPrice(item.price);
  return (
    <div className="flex items-center justify-between gap-4 py-4 px-5 md:px-6 border-b border-aegean-100 last:border-0">
      <h4 className="font-medium text-aegean-900">{item.name}</h4>
      {price && <span className="shrink-0 font-medium text-aegean-500 tabular-nums">{price}</span>}
    </div>
  );
}

export default function Meals() {
  const { meals } = pages;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/menu')
      .then((r) => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setItems(meals.items))
      .finally(() => setLoading(false));
  }, [meals.items]);

  const categories = useMemo(() => groupByCategory(items), [items]);

  return (
    <StaticPageLayout hero={{ ...meals, image: images.meals }} className="bg-aegean-50">
      <div className="max-w-3xl mx-auto mb-10 text-center">
        <div className="inline-flex items-center gap-2 text-aegean-500 mb-3">
          <UtensilsCrossed size={20} />
          <Coffee size={20} />
        </div>
        <p className="text-aegean-700 leading-relaxed">{meals.intro}</p>
        <p className="text-sm text-aegean-500 mt-3">{meals.hoursNote}</p>

        <a
          href={meals.pdfUrl}
          download="Caza-Buena-Menu.pdf"
          className="btn-primary inline-flex items-center gap-2 mt-8 text-sm"
        >
          <Download size={18} />
          Download Menu
        </a>
        <p className="text-xs text-aegean-500 mt-3">{meals.pdfNote}</p>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="max-w-3xl mx-auto space-y-10">
          {categories.map(([category, categoryItems]) => (
            <section key={category}>
              <h2 className="text-2xl font-serif text-aegean-800 mb-4 pb-2 border-b-2 border-aegean-200">
                {category}
              </h2>
              <div className="bg-white rounded-2xl shadow-sm border border-aegean-100">
                {categoryItems.map((item) => (
                  <MenuItemRow key={item.id ?? `${category}-${item.name}`} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-aegean-500 mt-10 max-w-2xl mx-auto">{meals.disclaimer}</p>
    </StaticPageLayout>
  );
}
