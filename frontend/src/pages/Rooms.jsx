import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, Calendar, BedDouble, Expand } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import api from '../api/client';
import StaticPageLayout from '../components/layout/StaticPageLayout';
import ImageDotSlider from '../components/ui/ImageDotSlider';
import PlaceholderImage from '../components/ui/PlaceholderImage';
import { CardSkeleton } from '../components/ui/ContentSkeleton';
import { pages, images, placeholderRooms } from '../data/placeholders';
import { bedroomCountLabel, roomShortDescription } from '../data/resortRules';

function formatStayDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export default function Rooms() {
  const { rooms: meta } = pages;
  const [searchParams] = useSearchParams();
  const checkIn = searchParams.get('check_in');
  const checkOut = searchParams.get('check_out');
  const guests = searchParams.get('guests');
  const isAvailabilitySearch = Boolean(checkIn && checkOut);

  const [rooms, setRooms] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usingPlaceholder, setUsingPlaceholder] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    setLoading(true);
    setSearchError('');

    if (isAvailabilitySearch) {
      api
        .get('/bookings/available-rooms', {
          params: {
            check_in: checkIn,
            check_out: checkOut,
            guests: guests || 2,
          },
        })
        .then((r) => {
          setRooms(r.data.rooms || []);
          setSearchMeta({
            check_in: r.data.check_in,
            check_out: r.data.check_out,
            guests: r.data.guests,
            nights: r.data.nights,
          });
          setUsingPlaceholder(false);
        })
        .catch(() => {
          setRooms([]);
          setSearchError('Could not load availability. Make sure the backend is running.');
        })
        .finally(() => setLoading(false));
      return;
    }

    api
      .get('/rooms')
      .then((r) => {
        setRooms(r.data);
        setUsingPlaceholder(r.data.length === 0);
        setSearchMeta(null);
      })
      .catch(() => {
        setRooms([]);
        setUsingPlaceholder(true);
      })
      .finally(() => setLoading(false));
  }, [checkIn, checkOut, guests, isAvailabilitySearch]);

  const display = usingPlaceholder && !isAvailabilitySearch ? placeholderRooms : rooms;

  const hero = isAvailabilitySearch
    ? {
        ...meta,
        title: 'Available Rooms',
        subtitle: searchMeta
          ? `${formatStayDate(searchMeta.check_in)} → ${formatStayDate(searchMeta.check_out)} · ${searchMeta.nights} night(s) · ${searchMeta.guests} guest${searchMeta.guests !== 1 ? 's' : ''}`
          : `${formatStayDate(checkIn)} → ${formatStayDate(checkOut)}`,
      }
    : meta;

  const buildBookUrl = (roomId) => {
    const params = new URLSearchParams({
      room: String(roomId),
      check_in: checkIn || '',
      check_out: checkOut || '',
      guests: guests || '2',
    });
    return `/booking?${params.toString()}`;
  };

  return (
    <StaticPageLayout hero={{ ...hero, image: images.rooms }}>
      {isAvailabilitySearch && !loading && !searchError && (
        <p className="text-center text-aegean-700 mb-8 max-w-2xl mx-auto">
          These units are available for your selected dates. Choose a room to continue with your booking.
        </p>
      )}

      {loading ? (
        <CardSkeleton count={3} />
      ) : searchError ? (
        <p className="text-center text-red-600 py-12">{searchError}</p>
      ) : display.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm max-w-lg mx-auto px-6">
          <Calendar className="w-12 h-12 text-aegean-400 mx-auto mb-4" />
          <h2 className="text-xl font-serif text-aegean-800 mb-2">No rooms available</h2>
          <p className="text-aegean-600 text-sm mb-6">
            {isAvailabilitySearch
              ? 'Try different dates, fewer guests, or contact us for assistance.'
              : 'No active rooms at the moment.'}
          </p>
          {isAvailabilitySearch && (
            <Link to="/" className="btn-primary text-sm">
              Change dates
            </Link>
          )}
        </div>
      ) : (
        <>
          {usingPlaceholder && !isAvailabilitySearch && (
            <p className="text-center text-sm text-aegean-500 mb-8">
              Placeholder rooms — activate rooms in Admin or check database connection
            </p>
          )}
          <div
            className={
              isAvailabilitySearch
                ? 'flex flex-col gap-6 max-w-4xl mx-auto'
                : 'grid md:grid-cols-2 lg:grid-cols-3 gap-8'
            }
          >
            {display.map((room) => {
              const roomImages = room.images?.length ? room.images : [];

              const media =
                usingPlaceholder && !isAvailabilitySearch && !roomImages.length ? (
                  <PlaceholderImage
                    src={room.images?.[0]?.image_url}
                    alt={room.name}
                    aspect="aspect-[4/3]"
                    label={`${room.name} — add photo`}
                  />
                ) : roomImages.length > 0 ? (
                  <ImageDotSlider
                    images={roomImages}
                    alt={room.name}
                    aspect={
                      isAvailabilitySearch
                        ? 'aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-[240px]'
                        : 'aspect-[4/3]'
                    }
                    className={isAvailabilitySearch ? 'sm:h-full' : ''}
                  />
                ) : (
                  <PlaceholderImage
                    alt={room.name}
                    aspect="aspect-[4/3]"
                    label={`${room.name} — add photo`}
                  />
                );

              const maxGuests = room.max_guests ?? room.capacity ?? 1;
              const minGuests = room.min_guests ?? 1;
              const roomArea = room.area_sqm ?? room.size_sqm ?? null;

              return (
                <article
                  key={room.id}
                  className="rounded-2xl overflow-hidden bg-white shadow-md border border-aegean-100 flex flex-col h-full"
                >
                  {!usingPlaceholder && !isAvailabilitySearch ? (
                    <Link to={`/rooms/${room.slug}`} className="block">
                      {media}
                    </Link>
                  ) : (
                    media
                  )}

                  <div className="p-5 sm:p-6 flex flex-col flex-1">
                    <h3 className="text-xl text-aegean-800">
                      {usingPlaceholder && !isAvailabilitySearch ? (
                        room.name
                      ) : (
                        <Link to={`/rooms/${room.slug}`} className="hover:text-aegean-600">
                          {room.name}
                        </Link>
                      )}
                    </h3>

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-aegean-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={16} className="text-aegean-500" />
                        {minGuests === maxGuests ? `${maxGuests} guest${maxGuests > 1 ? 's' : ''}` : `up to ${maxGuests} guests`}
                      </span>
                      {roomArea && (
                        <span className="inline-flex items-center gap-1.5">
                          <Expand size={15} className="text-aegean-500" />
                          {roomArea} m²
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <BedDouble size={16} className="text-aegean-500" />
                        {bedroomCountLabel(room.room_type)}
                      </span>
                    </div>

                    <p className="text-aegean-600/70 text-sm mt-1">{roomShortDescription(room)}</p>

                    <div className="mt-4">
                      {isAvailabilitySearch && room.subtotal != null ? (
                        <p className="text-aegean-600 font-medium">
                          Total ₱{Number(room.subtotal).toLocaleString()}
                          <span className="block text-sm font-normal text-aegean-600">
                            for {room.nights} night{room.nights !== 1 ? 's' : ''}, {formatStayDate(checkIn)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-aegean-600 font-medium">
                          From ₱{Number(room.price_per_night).toLocaleString()} / night
                        </p>
                      )}
                    </div>

                    {!usingPlaceholder && (
                      <div className="mt-auto pt-[30px]">
                        <Link
                          to={isAvailabilitySearch ? buildBookUrl(room.id) : `/booking?room=${room.id}`}
                          className="btn-primary text-center text-base block w-full"
                        >
                          {isAvailabilitySearch ? 'Book This Room' : 'Check Prices For Other Dates'}
                        </Link>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </StaticPageLayout>
  );
}
