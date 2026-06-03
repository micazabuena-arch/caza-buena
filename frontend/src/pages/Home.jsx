import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Waves, Star, MapPin } from 'lucide-react';
import api from '../api/client';
import PlaceholderImage from '../components/ui/PlaceholderImage';
import { CardSkeleton } from '../components/ui/ContentSkeleton';
import BookingSearchBar from '../components/booking/BookingSearchBar';
import { pages, images, placeholderRooms, resort } from '../data/placeholders';
import { roomShortDescription } from '../data/resortRules';

export default function Home() {
  const { home } = pages;
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/rooms')
      .then((r) => setRooms(r.data.slice(0, 3)))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  const featured = rooms.length > 0 ? rooms : placeholderRooms.slice(0, 3);
  const highlights = home.highlights.map((h, i) => ({
    ...h,
    icon: [Waves, MapPin, Star][i],
  }));

  return (
    <>
      <section className="relative min-h-[90vh] flex flex-col justify-center overflow-visible pb-32 md:pb-40">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, rgba(15,48,77,0.40), rgba(18,63,97,0.52)), url(/home_hero.jpg)',
          }}
        />
        <div
          className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto pt-16"
          style={{ textShadow: '0 2px 14px rgba(0,0,0,0.45)' }}
        >
          <p className="text-aegean-200 uppercase tracking-[0.3em] text-sm mb-4">{home.eyebrow}</p>
          <h1 className="text-5xl md:text-7xl font-serif mb-6">{home.title}</h1>
          <p className="text-xl md:text-2xl font-light italic mb-2">{resort.tagline}</p>
          <p className="text-lg text-white/90 max-w-xl mx-auto">{home.subtitle}</p>
        </div>

        {/* Booking search bar — overlaps hero bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-6 md:pb-8">
          <div className="container-narrow mx-auto max-w-5xl">
            <BookingSearchBar />
          </div>
        </div>
      </section>

      <section className="section-padding bg-aegean-50">
        <div className="container-narrow grid md:grid-cols-3 gap-8">
          {highlights.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center p-8 bg-white rounded-2xl shadow-sm">
              <Icon className="w-10 h-10 text-aegean-500 mx-auto mb-4" />
              <h3 className="text-xl text-aegean-800 mb-2">{title}</h3>
              <p className="text-aegean-600/80">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-padding">
        <div className="container-narrow">
          <div className="text-center mb-12">
            <p className="text-aegean-500 text-sm uppercase tracking-[0.2em] mb-2">Stay With Us</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl text-aegean-800">Accommodations</h2>
            <p className="mt-4 text-aegean-600/80 text-lg max-w-2xl mx-auto">
              From signature suites to cozy pods—find your perfect Aegean escape.
            </p>
          </div>

          {loading ? (
            <CardSkeleton count={3} />
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {featured.map((room) => (
                <Link
                  key={room.id}
                  to={rooms.length > 0 ? `/rooms/${room.slug}` : '/rooms'}
                  className="group rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-shadow"
                >
                  <PlaceholderImage
                    src={room.images?.[0]?.image_url}
                    alt={room.name}
                    aspect="aspect-[4/3]"
                    label={`${room.name} photo`}
                    className="group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="p-6">
                    <h3 className="text-xl text-aegean-800">{room.name}</h3>
                    <p className="text-aegean-600/70 text-sm mt-1 line-clamp-2">{roomShortDescription(room)}</p>
                    <p className="mt-4 text-aegean-600 font-medium">
                      From ₱{Number(room.price_per_night).toLocaleString()} / night
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="text-center mt-10">
            <Link to="/rooms" className="btn-outline inline-flex items-center gap-2">
              All Rooms <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section-padding bg-aegean-50">
        <div className="container-narrow">
          <div className="text-center mb-12">
            <p className="text-aegean-500 text-sm uppercase tracking-[0.2em] mb-2">Guest Reviews</p>
            <h2 className="text-3xl md:text-4xl text-aegean-800">Testimonials</h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {(home.testimonials || []).map((t, i) => (
              <article key={`${t.author}-${i}`} className="bg-white rounded-2xl p-6 shadow-sm border border-aegean-100">
                <div className="flex items-center gap-1 mb-4" aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, starIdx) => (
                    <Star
                      key={starIdx}
                      size={16}
                      className={starIdx < (t.rating || 5) ? 'text-yellow-500 fill-current' : 'text-aegean-200'}
                    />
                  ))}
                </div>
                <p className="text-aegean-700/90 text-sm leading-relaxed">"{t.quote}"</p>
                <p className="mt-4 font-medium text-aegean-800">- {t.author}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
