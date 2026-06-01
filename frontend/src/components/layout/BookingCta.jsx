import { Link } from 'react-router-dom';
import { pages, images } from '../../data/placeholders';

/** Full-width booking CTA — shown above the footer on public pages */
export default function BookingCta() {
  const { cta } = pages;

  return (
    <section className="relative section-padding text-center text-white overflow-hidden">
      <img
        src={images.cta}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
        aria-hidden
      />
      <div className="absolute inset-0 bg-aegean-900/55" />
      <div className="relative z-10 container-narrow max-w-2xl mx-auto px-4 sm:px-6">
        <h2 className="text-4xl font-serif mb-4">{cta.title}</h2>
        <p className="text-white/90 mb-8">{cta.text}</p>
        <Link
          to={cta.link}
          onClick={() => window.scrollTo(0, 0)}
          className="btn-primary bg-white text-aegean-500 hover:bg-aegean-50 hover:text-aegean-600"
        >
          {cta.button}
        </Link>
      </div>
    </section>
  );
}
