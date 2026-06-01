import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-aegean-500 text-white">
      <div className="section-padding pb-8">
        <div className="container-narrow grid md:grid-cols-3 gap-12">
          <div>
            <h3 className="font-serif text-3xl mb-3">Caza Buena</h3>
            <p className="text-aegean-200 italic">Your home after the sea</p>
            <p className="mt-4 text-sm text-aegean-200">DOT Accredited · Hostel · Café</p>
          </div>

          <div>
            <h4 className="font-medium mb-4 text-aegean-100">Explore</h4>
            <ul className="space-y-2 text-sm text-aegean-200">
              <li><Link to="/rooms" className="hover:text-white">Rooms</Link></li>
              <li><Link to="/amenities" className="hover:text-white">Amenities</Link></li>
              <li><Link to="/meals" className="hover:text-white">Meals</Link></li>
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
              <a href="tel:+639178290292" className="hover:text-white">+63 917 829 0292</a>
            </p>
            <p className="flex items-center gap-2">
              <Mail size={16} />
              <a href="mailto:mi.caza.buena@gmail.com" className="hover:text-white">mi.caza.buena@gmail.com</a>
            </p>
            <a
              href="https://www.instagram.com/cazabuena_"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-white"
            >
              <ExternalLink size={16} /> @cazabuena_
            </a>
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
