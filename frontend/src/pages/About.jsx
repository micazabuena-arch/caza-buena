import StaticPageLayout from '../components/layout/StaticPageLayout';
import PlaceholderImage from '../components/ui/PlaceholderImage';
import { pages, images, resort } from '../data/placeholders';

export default function About() {
  const { about } = pages;

  return (
    <StaticPageLayout hero={{ ...about, image: images.about }}>
      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <PlaceholderImage
          src={images.about}
          alt="Caza Buena resort"
          aspect="aspect-[4/5]"
          label="Resort exterior — replace with your photo"
          className="rounded-2xl shadow-lg"
        />
        <div className="space-y-6 text-aegean-700/90 leading-relaxed">
          <h2 className="text-3xl md:text-4xl font-serif text-aegean-800">{about.contentTitle}</h2>
          {about.paragraphs.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="p-4 bg-aegean-50 rounded-xl">
              <p className="text-2xl font-serif text-aegean-700">{resort.checkIn}</p>
              <p className="text-sm text-aegean-600">Check-in</p>
            </div>
            <div className="p-4 bg-aegean-50 rounded-xl">
              <p className="text-2xl font-serif text-aegean-700">{resort.checkOut}</p>
              <p className="text-sm text-aegean-600">Check-out</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16 grid sm:grid-cols-3 gap-6">
        {about.values.map((v) => (
          <div key={v.label} className="p-6 bg-aegean-50 rounded-2xl text-center">
            <p className="font-serif text-xl text-aegean-800 mb-2">{v.label}</p>
            <p className="text-sm text-aegean-600">{v.text}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-aegean-500 italic">{resort.dotAccredited}</p>
    </StaticPageLayout>
  );
}
