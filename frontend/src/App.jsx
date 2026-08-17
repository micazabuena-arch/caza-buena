import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Outlet,
  Route,
  RouterProvider,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Layout from './components/layout/Layout';
import ScrollToTop from './components/layout/ScrollToTop';

import Home from './pages/Home';

const About = lazy(() => import('./pages/About'));
const Rooms = lazy(() => import('./pages/Rooms'));
const RoomDetail = lazy(() => import('./pages/RoomDetail'));
const Amenities = lazy(() => import('./pages/Amenities'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Booking = lazy(() => import('./pages/Booking'));
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'));
const Contact = lazy(() => import('./pages/Contact'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Policies = lazy(() => import('./pages/Policies'));
const Meals = lazy(() => import('./pages/Meals'));
const WhatsNew = lazy(() => import('./pages/WhatsNew'));

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
const AdminQuotation = lazy(() => import('./admin/Quotation'));
const QuotationPrint = lazy(() => import('./admin/QuotationPrint'));
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

/** Data-router shell — required for useBlocker (unsaved leave) on Quotation / Pricing / etc. */
function AppShell() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppShell />}>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<Lazy><About /></Lazy>} />
        <Route path="rooms" element={<Lazy><Rooms /></Lazy>} />
        <Route path="rooms/:slug" element={<Lazy><RoomDetail /></Lazy>} />
        <Route path="amenities" element={<Lazy><Amenities /></Lazy>} />
        <Route path="gallery" element={<Lazy><Gallery /></Lazy>} />
        <Route path="meals" element={<Lazy><Meals /></Lazy>} />
        <Route path="whats-new" element={<Lazy><WhatsNew /></Lazy>} />
        <Route path="booking" element={<Lazy><Booking /></Lazy>} />
        <Route
          path="booking/confirm/:reference"
          element={
            <Lazy>
              <BookingConfirmation />
            </Lazy>
          }
        />
        <Route path="contact" element={<Lazy><Contact /></Lazy>} />
        <Route path="faq" element={<Lazy><FAQ /></Lazy>} />
        <Route path="policies" element={<Lazy><Policies /></Lazy>} />
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
        path="admin/quotation/print"
        element={
          <Lazy>
            <QuotationPrint />
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
        <Route path="quotation" element={<AdminQuotation />} />
        <Route path="quotation/new" element={<AdminQuotation />} />
        <Route path="quotation/:id" element={<AdminQuotation />} />
        <Route path="guests" element={<AdminGuests />} />
        <Route path="inquiries" element={<AdminInquiries />} />
        <Route path="gallery" element={<AdminGallery />} />
        <Route path="menu" element={<AdminMenu />} />
        <Route path="faq" element={<AdminFAQ />} />
        <Route path="policies" element={<AdminPolicies />} />
        <Route path="whats-new" element={<WhatsNewAdmin />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Route>
  )
);

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
