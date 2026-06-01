import { ImageIcon } from 'lucide-react';

/**
 * Branded image placeholder — use until final resort photos are uploaded.
 */
export default function PlaceholderImage({
  src,
  alt = 'Caza Buena',
  aspect = 'aspect-[4/3]',
  label = 'Photo placeholder',
  className = '',
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden ${aspect} ${className}`}>
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center bg-gradient-to-br from-aegean-100 to-aegean-200 text-aegean-600 ${aspect} ${className}`}
    >
      <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
      <span className="text-xs uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}
