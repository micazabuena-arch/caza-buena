import PageHero from '../ui/PageHero';
import { images } from '../../data/placeholders';

/** Wrapper for static marketing pages with shared hero + content area */
export default function StaticPageLayout({ hero, children, className = '' }) {
  return (
    <>
      <PageHero {...hero} image={images.pageHero} imagePosition={images.pageHeroObjectPosition} />
      <section className={`section-padding ${className}`}>
        <div className="container-narrow">{children}</div>
      </section>
    </>
  );
}
