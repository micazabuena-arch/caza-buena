import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Image,
  LogOut,
  Bed,
  CreditCard,
  Mail,
  Ban,
  HelpCircle,
  FileText,
  UtensilsCrossed,
  Sparkles,
  Menu,
  X,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/ui/Loading';

const nav = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/admin/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/admin/rooms', icon: Bed, label: 'Rooms' },
  { to: '/admin/availability', icon: Ban, label: 'Availability' },
  { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { to: '/admin/guests', icon: Users, label: 'Guests' },
  { to: '/admin/inquiries', icon: Mail, label: 'Inquiries' },
  { to: '/admin/gallery', icon: Image, label: 'Gallery' },
  { to: '/admin/menu', icon: UtensilsCrossed, label: 'Meals' },
  { to: '/admin/whats-new', icon: Sparkles, label: "What's New" },
  { to: '/admin/faq', icon: HelpCircle, label: 'FAQ' },
  { to: '/admin/policies', icon: FileText, label: 'Policies' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

function SidebarContent({ onNavigate }) {
  const { logout } = useAuth();

  return (
    <>
      <div className="p-5 lg:p-6 border-b border-aegean-600 flex items-center justify-between gap-3">
        <div>
          <Link to="/" className="inline-block" aria-label="Caza Buena home" onClick={onNavigate}>
            <img
              src="/logowhite.png"
              alt="Caza Buena"
              className="h-16 sm:h-20 lg:h-24 w-full max-w-[200px] object-contain"
            />
          </Link>
          <p className="text-xs text-aegean-300 mt-2">Admin Panel</p>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="lg:hidden p-2 rounded-lg hover:bg-aegean-600 text-white"
          aria-label="Close menu"
        >
          <X size={22} />
        </button>
      </div>
      <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-aegean-600' : 'hover:bg-aegean-600/80'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          logout();
        }}
        className="m-3 lg:m-4 flex items-center gap-2 px-4 py-2.5 text-sm text-aegean-200 hover:text-white rounded-lg hover:bg-aegean-600/50"
      >
        <LogOut size={16} /> Logout
      </button>
    </>
  );
}

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/admin/login" replace />;

  const closeNav = () => setNavOpen(false);

  return (
    <div className="min-h-screen bg-aegean-50 lg:flex">
      {navOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={closeNav}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(100%,280px)] bg-aegean-500 text-white flex flex-col shadow-xl transform transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:shadow-none lg:w-64 lg:shrink-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent onNavigate={closeNav} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 lg:min-h-screen">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b border-aegean-100 shadow-sm lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="p-2 rounded-lg text-aegean-700 hover:bg-aegean-50"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <img src="/logo.png" alt="" className="h-9 w-auto object-contain" />
          <span className="text-sm font-medium text-aegean-800 truncate">Admin</span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
