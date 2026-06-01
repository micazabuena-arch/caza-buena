import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import BookingCta from './BookingCta';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16 md:pt-20">
        <Outlet />
        <BookingCta />
      </main>
      <Footer />
    </div>
  );
}
