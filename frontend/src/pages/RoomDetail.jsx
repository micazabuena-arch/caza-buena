import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Users, Check, BedDouble } from 'lucide-react';
import { bedroomCountLabel, roomShortDescription } from '../data/resortRules';
import RoomCapacityPricingNote from '../components/booking/RoomCapacityPricingNote';
import api from '../api/client';
import PageHero from '../components/ui/PageHero';
import ImageDotSlider from '../components/ui/ImageDotSlider';
import { CardSkeleton } from '../components/ui/ContentSkeleton';
import { images, placeholderRooms } from '../data/placeholders';

export default function RoomDetail() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const checkIn = searchParams.get('check_in');
  const checkOut = searchParams.get('check_out');
  const guests = searchParams.get('guests');
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .get(`/rooms/${slug}`)
      .then((r) => setRoom(r.data))
      .catch(() => {
        const fallback = placeholderRooms.find((r) => r.slug === slug);
        if (fallback) {
          setRoom({
            ...fallback,
            description: fallback.short_description,
            amenities: ['Air conditioning', 'En-suite bathroom'],
          });
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <>
        <PageHero title="Loading..." subtitle="" image={images.pageHero} imagePosition={images.pageHeroObjectPosition} />
        <section className="section-padding">
          <div className="container-narrow"><CardSkeleton count={1} /></div>
        </section>
      </>
    );
  }

  if (notFound || !room) {
    return (
      <>
        <PageHero title="Room Not Found" subtitle="This accommodation may be unavailable." image={images.pageHero} imagePosition={images.pageHeroObjectPosition} />
        <section className="section-padding text-center">
          <Link to="/rooms" className="btn-primary">View All Rooms</Link>
        </section>
      </>
    );
  }

  const gallery = room.images?.length > 0
    ? room.images
    : [{ image_url: images.room }];

  const bookUrl = (() => {
    const params = new URLSearchParams({ room: String(room.id) });
    if (checkIn) params.set('check_in', checkIn);
    if (checkOut) params.set('check_out', checkOut);
    if (guests) params.set('guests', guests);
    return `/booking?${params.toString()}`;
  })();

  return (
    <>
      <PageHero
        eyebrow="Accommodation"
        title={room.name}
        subtitle={roomShortDescription(room)}
        image={images.pageHero}
        imagePosition={images.pageHeroObjectPosition}
      />
      <section className="section-padding">
        <div className="container-narrow">
          <div className="grid lg:grid-cols-2 gap-10">
            <div>
              <ImageDotSlider
                images={gallery}
                alt={room.name}
                aspect="aspect-[4/3]"
                className="rounded-2xl"
                dotClassName="bottom-4"
                autoSlide
              />
            </div>
            <div>
              <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-aegean-600 mb-6">
                <span className="inline-flex items-center gap-2">
                  <Users size={18} /> {room.min_guests ?? 1}–{room.max_guests ?? room.capacity} guests
                </span>
                <span className="inline-flex items-center gap-2">
                  <BedDouble size={18} /> {bedroomCountLabel(room.room_type)}
                </span>
              </p>
              <RoomCapacityPricingNote room={room} size="hero" className="mb-6" />
              <p className="text-aegean-700/90 leading-relaxed mb-8">{room.description}</p>

              {room.amenities?.length > 0 && (
                <ul className="space-y-2 mb-8">
                  {room.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2 text-aegean-700">
                      <Check size={16} className="text-aegean-500" /> {a}
                    </li>
                  ))}
                </ul>
              )}

              {String(room.id).startsWith('ph-') ? (
                <p className="text-sm text-aegean-500 mb-4">Placeholder room — booking available when connected to live rooms.</p>
              ) : (
                <Link to={bookUrl} className="btn-primary">
                  Book This Room
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
