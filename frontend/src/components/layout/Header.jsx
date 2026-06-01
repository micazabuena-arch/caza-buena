import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/amenities', label: 'Amenities' },
  { to: '/meals', label: 'Meals' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-aegean-100">
      <div className="container-narrow mx-auto flex items-center justify-between h-20 md:h-24 px-4 sm:px-6">
        <Link to="/" className="flex items-center" aria-label="Caza Buena home">
          <img
            src="/logo.png"
            alt="Caza Buena"
            className="h-16 md:h-24 w-auto object-contain"
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-aegean-500' : 'text-aegean-800/70 hover:text-aegean-500'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Link to="/booking" className="btn-primary text-sm py-2.5 px-5">
            Book Now
          </Link>
        </nav>

        <button
          type="button"
          className="lg:hidden p-2 text-aegean-500"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-white border-t border-aegean-100 px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="block py-2 text-aegean-800 font-medium"
            >
              {link.label}
            </NavLink>
          ))}
          <Link to="/booking" onClick={() => setOpen(false)} className="btn-primary w-full text-center">
            Book Now
          </Link>
        </div>
      )}
    </header>
  );
}
