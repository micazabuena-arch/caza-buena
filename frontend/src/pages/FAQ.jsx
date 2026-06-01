import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import api from '../api/client';
import StaticPageLayout from '../components/layout/StaticPageLayout';
import { ListSkeleton } from '../components/ui/ContentSkeleton';
import { pages, images } from '../data/placeholders';

export default function FAQ() {
  const { faq } = pages;
  const [faqs, setFaqs] = useState([]);
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/faqs')
      .then((r) => setFaqs(r.data))
      .catch(() => setFaqs([]))
      .finally(() => setLoading(false));
  }, []);

  // Prefer curated list when API data is missing or shorter than our latest FAQs
  const display = faqs.length >= faq.items.length ? faqs : faq.items;

  return (
    <StaticPageLayout hero={{ ...faq, image: images.faq }} className="bg-aegean-50">
      <div className="max-w-3xl mx-auto">
        {loading ? (
          <ListSkeleton count={5} />
        ) : (
          <>
            {faqs.length === 0 && (
              <p className="text-center text-sm text-aegean-500 mb-6">Placeholder FAQs — edit in Admin → FAQ</p>
            )}
            <div className="space-y-3">
              {display.map((item, i) => (
                <div key={item.id || i} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpen(open === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left font-medium text-aegean-800"
                  >
                    {item.question}
                    <ChevronDown className={`shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
                  </button>
                  {open === i && (
                    <div className="px-5 pb-5 text-aegean-600/90 leading-relaxed whitespace-pre-line">
                      {item.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </StaticPageLayout>
  );
}
