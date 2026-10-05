import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CookieConsent from './components/ui/CookieConsent.jsx';

// Split the heavier / less-visited pages out of the first download.
const Room = lazy(() => import('./pages/Room.jsx'));
const Join = lazy(() => import('./pages/Join.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading">
      <span className="spinner" />
    </div>
  );
}

/** Scroll to top on route change (but keep #hash jumps). */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/join" element={<Join />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <CookieConsent />
    </>
  );
}
