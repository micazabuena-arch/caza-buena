import { useCallback, useEffect, useMemo, useState } from 'react';
import StaticPageLayout from '../components/layout/StaticPageLayout';
import Loading from '../components/ui/Loading';
import ImageDotSlider from '../components/ui/ImageDotSlider';
import api from '../api/client';
import { pages, images } from '../data/placeholders';

const FALLBACK = {
  heading: "What's New at Caza Buena",
  text: 'Fresh updates, new highlights, and the latest moments from our resort.',
};

/** A4 portrait ratio (210 × 297 mm) */
const A4_ASPECT = 'aspect-[210/297]';

function normalizeSlides(data) {
  let raw = [];
  if (Array.isArray(data?.slides) && data.slides.length) {
    raw = data.slides.slice(0, 3);
  } else if (Array.isArray(data?.images)) {
    raw = data.images.slice(0, 3).map((url) => ({ image_url: url, heading: '', text: '' }));
  }

  return raw
    .map((slide, i) => ({
      id: `whats-new-${i + 1}`,
      image_url: String(slide?.image_url || slide || '').trim(),
      heading: slide?.heading || '',
      text: slide?.text || '',
    }))
    .filter((slide) => slide.image_url);
}

export default function WhatsNew() {
  const [content, setContent] = useState({ ...FALLBACK, slides: [] });
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/whats-new')
      .then((r) => {
        const data = r.data || {};
        setContent({
          heading: data.heading || FALLBACK.heading,
          text: data.text || FALLBACK.text,
          slides: normalizeSlides(data),
        });
        setActiveIndex(0);
      })
      .catch(() => setContent({ ...FALLBACK, slides: [] }))
      .finally(() => setLoading(false));
  }, []);

  const sliderImages = useMemo(
    () => content.slides.map((s) => ({ id: s.id, image_url: s.image_url })),
    [content.slides]
  );

  const handleSlideChange = useCallback((index) => {
    setActiveIndex(index);
  }, []);

  const activeSlide = content.slides[activeIndex] || content.slides[0];

  return (
    <StaticPageLayout
      hero={{
        eyebrow: 'Latest Updates',
        title: "What's New",
        subtitle: 'Recent highlights and moments from Caza Buena.',
        image: images.gallery,
      }}
    >
      {loading ? (
        <Loading />
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-4xl font-serif text-aegean-800">{content.heading}</h2>
            <p className="text-aegean-700 leading-relaxed max-w-2xl mx-auto">{content.text}</p>
          </div>

          <div className="w-full max-w-[min(100%,210mm)] mx-auto">
            {sliderImages.length > 0 ? (
              <>
                <div className="rounded-2xl overflow-hidden border border-aegean-100 shadow-md bg-white">
                  <ImageDotSlider
                    images={sliderImages}
                    alt={content.heading || pages.gallery.title}
                    aspect={A4_ASPECT}
                    objectFit="contain"
                    autoSlide={sliderImages.length > 1}
                    intervalMs={4000}
                    showArrows
                    openImageOnClick
                    onSlideChange={handleSlideChange}
                  />
                </div>

                {(activeSlide?.heading || activeSlide?.text) && (
                  <div className="mt-5 text-center space-y-2 px-2">
                    {activeSlide.heading && (
                      <h3 className="text-xl md:text-2xl font-serif text-aegean-800">{activeSlide.heading}</h3>
                    )}
                    {activeSlide.text && (
                      <p className="text-aegean-700 leading-relaxed">{activeSlide.text}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-aegean-600 text-sm py-10 border border-dashed border-aegean-200 rounded-2xl bg-white">
                New updates will appear here soon.
              </p>
            )}
          </div>
        </div>
      )}
    </StaticPageLayout>
  );
}
