import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAssetUrl } from '../../utils/assetUrl';

/**
 * One image at a time (stacked layers) — arrows, dots, and 1/N counter.
 */
export default function ImageDotSlider({
  images = [],
  alt = '',
  aspect = 'aspect-[4/3]',
  className = '',
  dotClassName = '',
  autoSlide = true,
  intervalMs = 3500,
  showArrows = true,
  showCounter = true,
  openImageOnClick = false,
  onSlideChange,
  objectFit = 'cover',
}) {
  const objectFitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';
  const slides = useMemo(() => {
    const seen = new Set();
    return (images || []).filter((img) => {
      const url = img?.image_url;
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }, [images]);

  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  const count = slides.length;
  const safeIndex = count > 0 ? Math.max(0, Math.min(index, count - 1)) : 0;
  const slideNumber = safeIndex + 1;

  useEffect(() => {
    setIndex(0);
  }, [slides]);

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [index, count]);

  useEffect(() => {
    onSlideChange?.(safeIndex);
  }, [safeIndex, onSlideChange]);

  const step = useCallback(
    (delta) => {
      if (count <= 1) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count]
  );

  const goToSlide = useCallback(
    (target) => {
      if (target >= 0 && target < count) setIndex(target);
    },
    [count]
  );

  useEffect(() => {
    if (!autoSlide || count <= 1 || isHovered || touchStartX !== null) return;
    const timer = setInterval(() => step(1), intervalMs);
    return () => clearInterval(timer);
  }, [autoSlide, count, intervalMs, isHovered, touchStartX, step]);

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null || count <= 1) return;
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) {
      step(delta > 0 ? 1 : -1);
    }
    setTouchStartX(null);
  };

  if (count === 0) return null;

  return (
    <div
      className={`relative w-full overflow-hidden bg-aegean-100 ${aspect} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {slides.map((slide, i) => (
        <img
          key={slide.id ?? slide.image_url ?? i}
          src={getAssetUrl(slide.image_url)}
          alt={i === 0 ? alt : `${alt} ${i + 1}`}
          className={`absolute inset-0 h-full w-full ${objectFitClass} transition-opacity duration-300 ${
            i === safeIndex ? 'opacity-100 z-[1]' : 'opacity-0 z-0 pointer-events-none'
          } ${openImageOnClick ? 'cursor-zoom-in' : ''}`}
          onClick={(e) => {
            if (!openImageOnClick) return;
            e.preventDefault();
            e.stopPropagation();
            const url = getAssetUrl(slide.image_url);
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
          }}
          draggable={false}
          aria-hidden={i !== safeIndex}
        />
      ))}

      {showArrows && count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              step(-1);
            }}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/55 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              step(1);
            }}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/55 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {count > 1 && (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-20 w-full bg-gradient-to-t from-black/75 via-black/35 to-transparent"
            aria-hidden
          />
          <div
            className={`absolute inset-x-0 bottom-0 z-10 flex w-full min-w-0 items-center justify-between gap-3 px-4 pb-3 pt-10 ${dotClassName}`}
          >
            <div
              className="flex min-w-0 flex-1 justify-center gap-1.5"
              role="tablist"
              aria-label="Image gallery"
            >
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  aria-label={`Image ${i + 1} of ${count}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    goToSlide(i);
                  }}
                  className={`h-2 shrink-0 rounded-full transition-all ${
                    i === safeIndex ? 'w-5 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
            {showCounter && (
              <span className="shrink-0 text-xs font-medium tabular-nums text-white">
                {slideNumber} / {count}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
