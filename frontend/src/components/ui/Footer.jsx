import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import { CONTACT_EMAIL } from '../../lib/site.js';
import { openConsentSettings } from '../../lib/consent.js';
import './Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo size={24} />
          <p className="muted">Watch movies together, face to face — wherever you are.</p>
          <a className="footer-email" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <div className="footer-col">
            <span className="footer-col-title">Product</span>
            <Link to="/#how-it-works">How it works</Link>
            <Link to="/#features">Features</Link>
            <Link to="/#faq">FAQ</Link>
            <Link to="/join">Join a room</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Legal</span>
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/terms">Terms of service</Link>
            <button type="button" className="link-button footer-link-btn" onClick={openConsentSettings}>
              Cookie settings
            </button>
          </div>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {year} Streamly</span>
        <span>Video calls are peer-to-peer and never stored.</span>
      </div>
    </footer>
  );
}
