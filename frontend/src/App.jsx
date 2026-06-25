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

import AdminLayout from './admin/AdminLayout';
import AdminLogin from './admin/Login';
import AdminDashboard from './admin/Dashboard';
import AdminBookings from './admin/Bookings';
import AdminCalendar from './admin/Calendar';
import AdminRooms from './admin/Rooms';
import AdminGuests from './admin/Guests';
import AdminGallery from './admin/GalleryAdmin';
import AdminPaymentMethods from './admin/PaymentMethods';
import AdminInquiries from './admin/Inquiries';
import AdminAvailability from './admin/Availability';
import AdminFAQ from './admin/FAQAdmin';
import AdminMenu from './admin/MenuAdmin';
import AdminPolicies from './admin/PoliciesAdmin';
import WhatsNewAdmin from './admin/WhatsNewAdmin';
import AdminSettings from './admin/Settings';
import IslandHoppingPrint from './admin/IslandHoppingPrint';
import BookingSoaPrint from './admin/BookingSoaPrint';

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

          <Route path="admin/login" element={<AdminLogin />} />
          <Route path="admin/bookings/:bookingId/print-island" element={<IslandHoppingPrint />} />
          <Route path="admin/bookings/:bookingId/print-soa" element={<BookingSoaPrint />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="rooms" element={<AdminRooms />} />
            <Route path="availability" element={<AdminAvailability />} />
            <Route path="payments" element={<AdminPaymentMethods />} />
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
