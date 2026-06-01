import { useCallback, useEffect, useState } from 'react';
import { getAssetUrl } from '../../utils/assetUrl';

/**
 * Image carousel with pagination dots only (no arrows).
 * Supports touch swipe on mobile.
 */
export default function ImageDotSlider({
  images = [],
  alt = '',
  aspect = 'aspect-[4/3]',
  className = '',
  dotClassName = '',
  autoSlide = true,
  intervalMs = 3500,
}) {
  const slides = (images || []).filter((img) => img?.image_url);
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  const count = slides.length;

  useEffect(() => {
    setIndex((i) => (count > 0 && i >= count ? 0 : i));
  }, [count]);

  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;
  const current = slides[safeIndex];

  const goTo = useCallback(
    (next) => {
      if (count <= 1) return;
      setIndex((i) => {
        if (typeof next === 'number') return next;
        return (i + next + count) % count;
      });
    },
    [count]
  );

  if (count === 0) return null;

  useEffect(() => {
    if (!autoSlide || count <= 1 || isHovered || touchStartX !== null) return;
    const timer = setInterval(() => {
      goTo(1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoSlide, count, intervalMs, isHovered, touchStartX, goTo]);

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null || count <= 1) return;
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) {
      goTo(delta > 0 ? 1 : -1);
    }
    setTouchStartX(null);
  };

  return (
    <div
      className={`relative overflow-hidden bg-aegean-100 ${aspect} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={getAssetUrl(current.image_url)}
        alt={alt}
        className="w-full h-full object-cover transition-opacity duration-300"
        draggable={false}
      />

      {count > 1 && (
        <div
          className={`absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-2 px-3 ${dotClassName}`}
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
                setIndex(i);
              }}
              className={`h-2 rounded-full transition-all ${
                i === safeIndex ? 'w-5 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
