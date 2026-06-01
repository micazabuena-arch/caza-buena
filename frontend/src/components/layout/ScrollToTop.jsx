import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scroll to top when the route changes (e.g. CTA → /rooms) */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
