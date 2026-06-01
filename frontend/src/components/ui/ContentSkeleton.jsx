/** Loading skeleton for card grids on static pages */
export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-md animate-pulse">
          <div className="aspect-[4/3] bg-aegean-100" />
          <div className="p-6 space-y-3">
            <div className="h-5 bg-aegean-100 rounded w-3/4" />
            <div className="h-4 bg-aegean-50 rounded w-full" />
            <div className="h-4 bg-aegean-50 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export function GallerySkeleton({ count = 6 }) {
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="break-inside-avoid aspect-[3/4] bg-aegean-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
