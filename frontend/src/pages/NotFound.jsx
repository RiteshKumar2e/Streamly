import { Link } from 'react-router-dom';
import Navbar from '../components/ui/Navbar.jsx';
import Footer from '../components/ui/Footer.jsx';
import { usePageMeta } from '../lib/site.js';

export default function NotFound() {
  usePageMeta({ title: 'Page not found', description: 'This page does not exist.', noindex: true });
  return (
    <div className="page">
      <Navbar />
      <main className="page-center">
        <div className="card page-card" style={{ textAlign: 'center' }}>
          <span className="badge badge-neutral">404</span>
          <h1 style={{ marginTop: 16 }}>Page not found</h1>
          <p className="muted">The page you are looking for doesn't exist or has moved.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn-primary">Back to home</Link>
            <Link to="/join" className="btn btn-secondary">Join a room</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
