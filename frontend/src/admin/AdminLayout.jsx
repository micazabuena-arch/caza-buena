import { Link, NavLink, Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Image, LogOut, Bed, CreditCard, Mail, Ban, HelpCircle, FileText, UtensilsCrossed } from 'lucide-react';
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
  { to: '/admin/faq', icon: HelpCircle, label: 'FAQ' },
  { to: '/admin/policies', icon: FileText, label: 'Policies' },
];

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen flex bg-aegean-50">
      <aside className="w-64 bg-aegean-500 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-aegean-600">
          <Link to="/" className="font-serif text-2xl">Caza Buena</Link>
          <p className="text-xs text-aegean-300 mt-1">Admin Panel</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-aegean-600' : 'hover:bg-aegean-600/80'
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="m-4 flex items-center gap-2 px-4 py-2 text-sm text-aegean-200 hover:text-white"
        >
          <LogOut size={16} /> Logout
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
