import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo.jsx';
import './Navbar.css';

export default function Navbar() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const onHome = pathname === '/';
  const prefix = onHome ? '' : '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={`navbar${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container navbar-inner">
        <Logo />
        <nav className={`navbar-links${open ? ' is-open' : ''}`} aria-label="Main">
          <a href={`${prefix}#how-it-works`} onClick={() => setOpen(false)}>How it works</a>
          <a href={`${prefix}#features`} onClick={() => setOpen(false)}>Features</a>
          <a href={`${prefix}#faq`} onClick={() => setOpen(false)}>FAQ</a>
          <Link to="/join">Join with code</Link>
        </nav>
        <div className="navbar-actions">
          <a href={`${prefix}#start`} className="btn btn-primary btn-sm navbar-cta">
            Start a watch party
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm navbar-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
