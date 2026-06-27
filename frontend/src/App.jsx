import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Layout from './components/layout/Layout';
import ScrollToTop from './components/layout/ScrollToTop';

import Home from './pages/Home';
import About from './pages/About';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import Amenities from './pages/Amenities';
import Gallery from './pages/Gallery';
import Booking from './pages/Booking';
import BookingConfirmation from './pages/BookingConfirmation';
import Contact from './pages/Contact';
import FAQ from './pages/FAQ';
import Policies from './pages/Policies';
import Meals from './pages/Meals';
import WhatsNew from './pages/WhatsNew';

const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AdminLogin = lazy(() => import('./admin/Login'));
const AdminDashboard = lazy(() => import('./admin/Dashboard'));
const AdminBookings = lazy(() => import('./admin/Bookings'));
const AdminCalendar = lazy(() => import('./admin/Calendar'));
const AdminRooms = lazy(() => import('./admin/Rooms'));
const AdminGuests = lazy(() => import('./admin/Guests'));
const AdminGallery = lazy(() => import('./admin/GalleryAdmin'));
const AdminPaymentMethods = lazy(() => import('./admin/PaymentMethods'));
const AdminInquiries = lazy(() => import('./admin/Inquiries'));
const AdminAvailability = lazy(() => import('./admin/Availability'));
const AdminFAQ = lazy(() => import('./admin/FAQAdmin'));
const AdminMenu = lazy(() => import('./admin/MenuAdmin'));
const AdminPolicies = lazy(() => import('./admin/PoliciesAdmin'));
const WhatsNewAdmin = lazy(() => import('./admin/WhatsNewAdmin'));
const AdminSettings = lazy(() => import('./admin/Settings'));
const AdminPricing = lazy(() => import('./admin/Pricing'));
const IslandHoppingPrint = lazy(() => import('./admin/IslandHoppingPrint'));
const BookingSoaPrint = lazy(() => import('./admin/BookingSoaPrint'));

function PageLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-aegean-600 text-sm">
      Loading…
    </div>
  );
}

function Lazy({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <ConfirmProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="rooms/:slug" element={<RoomDetail />} />
            <Route path="amenities" element={<Amenities />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="meals" element={<Meals />} />
            <Route path="whats-new" element={<WhatsNew />} />
            <Route path="booking" element={<Booking />} />
            <Route path="booking/confirm/:reference" element={<BookingConfirmation />} />
            <Route path="contact" element={<Contact />} />
            <Route path="faq" element={<FAQ />} />
            <Route path="policies" element={<Policies />} />
          </Route>

          <Route
            path="admin/login"
            element={
              <Lazy>
                <AdminLogin />
              </Lazy>
            }
          />
          <Route
            path="admin/bookings/:bookingId/print-island"
            element={
              <Lazy>
                <IslandHoppingPrint />
              </Lazy>
            }
          />
          <Route
            path="admin/bookings/:bookingId/print-soa"
            element={
              <Lazy>
                <BookingSoaPrint />
              </Lazy>
            }
          />
          <Route
            path="admin"
            element={
              <Lazy>
                <AdminLayout />
              </Lazy>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="rooms" element={<AdminRooms />} />
            <Route path="availability" element={<AdminAvailability />} />
            <Route path="payments" element={<AdminPaymentMethods />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="guests" element={<AdminGuests />} />
            <Route path="inquiries" element={<AdminInquiries />} />
            <Route path="gallery" element={<AdminGallery />} />
            <Route path="menu" element={<AdminMenu />} />
            <Route path="faq" element={<AdminFAQ />} />
            <Route path="policies" element={<AdminPolicies />} />
            <Route path="whats-new" element={<WhatsNewAdmin />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
