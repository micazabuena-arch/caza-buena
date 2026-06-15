import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';
import { resort } from '../../data/placeholders';
import { FacebookIcon, InstagramIcon, TikTokIcon } from '../ui/SocialIcon';

const socialLinks = [
  { href: resort.facebook, label: 'Facebook', Icon: FacebookIcon },
  { href: resort.instagram, label: 'Instagram', Icon: InstagramIcon },
  { href: resort.tiktok, label: 'TikTok', Icon: TikTokIcon },
].filter((item) => item.href);

export default function Footer() {
  return (
    <footer className="bg-aegean-500 text-white">
      <div className="section-padding pb-8">
        <div className="container-narrow grid md:grid-cols-3 gap-12">
          <div>
            <img
              src="/logowhite.png"
              alt="Caza Buena"
              className="h-32 md:h-36 w-auto max-w-[280px] object-contain mb-4"
            />
            <p className="text-aegean-200 italic">Your home after the sea</p>
            <p className="mt-4 text-sm text-aegean-200">DOT Accredited · Hostel · Café</p>
            {socialLinks.length > 0 && (
              <div className="flex items-center gap-3 mt-5">
                {socialLinks.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Caza Buena on ${label}`}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white hover:text-aegean-600 transition-colors"
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-medium mb-4 text-aegean-100">Explore</h4>
            <ul className="space-y-2 text-sm text-aegean-200">
              <li><Link to="/rooms" className="hover:text-white">Rooms</Link></li>
              <li><Link to="/amenities" className="hover:text-white">Amenities</Link></li>
              <li><Link to="/meals" className="hover:text-white">Meals</Link></li>
              <li><Link to="/whats-new" className="hover:text-white">What&apos;s New</Link></li>
              <li><Link to="/booking" className="hover:text-white">Book a Stay</Link></li>
              <li><Link to="/policies" className="hover:text-white">Policies</Link></li>
            </ul>
          </div>

          <div className="space-y-3 text-sm text-aegean-200">
            <p className="flex items-start gap-2">
              <MapPin size={16} className="mt-0.5 shrink-0" />
              Sitio Inansuana, Brgy. Lucap, Alaminos, Pangasinan
            </p>
            <p className="flex items-center gap-2">
              <Phone size={16} />
              <a href={`tel:${resort.phoneTel}`} className="hover:text-white">{resort.phone}</a>
            </p>
            <p className="flex items-center gap-2">
              <Mail size={16} />
              <a href={`mailto:${resort.email}`} className="hover:text-white">{resort.email}</a>
            </p>
          </div>
        </div>

        <div className="container-narrow mt-12 pt-8 border-t border-aegean-600 text-center text-sm text-aegean-300">
          <p>Check-in 1:00 PM · Check-out 11:00 AM</p>
          <p className="mt-2">© {new Date().getFullYear()} Caza Buena. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
