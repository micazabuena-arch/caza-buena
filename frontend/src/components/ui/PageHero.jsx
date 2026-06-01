/**
 * Hero banner for static inner pages — consistent branding across the site.
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
  imagePosition = '88% 50%',
}) {
  return (
    <section className="relative h-[44vh] min-h-[320px] max-h-[480px] flex items-center overflow-hidden">
      {image ? (
        <>
          <img
            src={image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: imagePosition }}
          />
          {/* Readability on the left; right ~40% stays clear for wall logo */}
          <div className="absolute inset-y-0 left-0 w-[52%] bg-gradient-to-r from-aegean-900/78 via-aegean-900/35 to-transparent" />
          <div className="absolute bottom-0 left-0 w-[52%] h-[50%] bg-gradient-to-t from-aegean-900/55 via-transparent to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-aegean-500 to-aegean-700" />
      )}
      {/* Same horizontal grid as StaticPageLayout content (section-padding + container-narrow) */}
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="container-narrow">
          <div className="max-w-xl md:max-w-2xl lg:max-w-[52%] text-left text-white">
            {eyebrow && (
              <p className="text-aegean-200 uppercase tracking-[0.25em] text-xs md:text-sm mb-2">{eyebrow}</p>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-tight">{title}</h1>
            {subtitle && <p className="mt-3 text-base md:text-lg text-white/90 max-w-md md:max-w-lg">{subtitle}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
