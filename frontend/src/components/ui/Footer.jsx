import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import './Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo size={24} />
          <p className="muted">Watch movies together, face to face — wherever you are.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="/#how-it-works">How it works</a>
          <a href="/#features">Features</a>
          <a href="/#faq">FAQ</a>
          <Link to="/join">Join a room</Link>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {year} Streamly</span>
        <span>Video calls are peer-to-peer and never stored.</span>
      </div>
    </footer>
  );
}
