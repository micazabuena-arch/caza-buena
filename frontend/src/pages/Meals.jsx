import { useMemo } from 'react';
import { Coffee, Download, UtensilsCrossed } from 'lucide-react';
import StaticPageLayout from '../components/layout/StaticPageLayout';
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
    <div className="py-4 border-b border-aegean-100 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-aegean-900">{item.name}</h4>
          {item.description && (
            <p className="text-sm text-aegean-600/90 mt-1 leading-relaxed">{item.description}</p>
          )}
        </div>
        {price && (
          <span className="shrink-0 font-medium text-aegean-500 tabular-nums">{price}</span>
        )}
      </div>
    </div>
  );
}

export default function Meals() {
  const { meals } = pages;
  const display = meals.items;
  const featured = useMemo(() => display.filter((i) => i.is_featured), [display]);
  const categories = useMemo(() => groupByCategory(display), [display]);

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
          Download Menu (PDF)
        </a>
        <p className="text-xs text-aegean-500 mt-3">{meals.pdfNote}</p>
      </div>

      {featured.length > 0 && (
        <div className="mb-12 max-w-3xl mx-auto">
          <h2 className="text-2xl font-serif text-aegean-800 text-center mb-6">Chef&apos;s Picks</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-aegean-100 px-6 md:px-8">
            {featured.map((item) => (
              <MenuItemRow key={item.name} item={item} />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-10">
        {categories.map(([category, categoryItems]) => (
          <div key={category}>
            <h2 className="text-2xl font-serif text-aegean-800 mb-4 pb-2 border-b-2 border-aegean-200">
              {category}
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-aegean-100 px-6 md:px-8">
              {categoryItems.map((item) => (
                <MenuItemRow key={`${category}-${item.name}`} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-aegean-500 mt-10 max-w-2xl mx-auto">{meals.disclaimer}</p>
    </StaticPageLayout>
  );
}
