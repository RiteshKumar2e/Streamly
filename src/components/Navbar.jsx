import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ connectionState }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const getStatusLabel = () => {
    switch (connectionState) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'pairing': return 'Pairing...';
      case 'transferring': return 'Transferring...';
      case 'ready': return 'Ready';
      case 'playing': return 'Playing';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Error';
      default: return null;
    }
  };

  const getStatusClass = () => {
    switch (connectionState) {
      case 'connected':
      case 'ready':
      case 'playing':
        return 'connected';
      case 'connecting':
      case 'pairing':
      case 'transferring':
        return 'connecting';
      case 'error':
        return 'error';
      default:
        return '';
    }
  };

  const statusLabel = getStatusLabel();

  return (
    <header className="navbar" id="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand" title="Streamly — Home">
          <img src="/streamly.svg" alt="Streamly Logo" className="navbar-logo" width="34" height="34" />
          <span className="navbar-title">Streamly</span>
          <span className="navbar-badge">P2P Direct</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="navbar-nav-links desktop-only" aria-label="Main Navigation">
          <Link
            to="/phone"
            className={`navbar-link ${location.pathname === '/phone' ? 'active' : ''}`}
            id="nav-link-phone"
          >
            <span className="nav-icon" aria-hidden="true">📱</span>
            <span>Connect Phone</span>
          </Link>
          <Link
            to="/laptop"
            className={`navbar-link ${location.pathname === '/laptop' ? 'active' : ''}`}
            id="nav-link-laptop"
          >
            <span className="nav-icon" aria-hidden="true">💻</span>
            <span>Connect Laptop</span>
          </Link>
        </nav>
      </div>

      <div className="navbar-actions">
        {statusLabel && (
          <div className="navbar-status" aria-live="polite">
            <div className={`status-dot ${getStatusClass()}`} />
            <span>{statusLabel}</span>
          </div>
        )}

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className="mobile-menu-toggle mobile-only"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          id="mobile-menu-toggle"
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer animate-fade-in" id="mobile-menu">
          <nav className="mobile-nav-list" aria-label="Mobile Navigation">
            <Link
              to="/"
              className={`mobile-nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              <span>🏠 Home</span>
            </Link>
            <Link
              to="/phone"
              className={`mobile-nav-link ${location.pathname === '/phone' ? 'active' : ''}`}
            >
              <span>📱 Connect Phone</span>
            </Link>
            <Link
              to="/laptop"
              className={`mobile-nav-link ${location.pathname === '/laptop' ? 'active' : ''}`}
            >
              <span>💻 Connect Laptop</span>
            </Link>
            <div className="mobile-nav-divider" />
            <Link
              to="/privacy"
              className={`mobile-nav-link ${location.pathname === '/privacy' ? 'active' : ''}`}
            >
              <span>🔒 Privacy Policy</span>
            </Link>
            <Link
              to="/terms"
              className={`mobile-nav-link ${location.pathname === '/terms' ? 'active' : ''}`}
            >
              <span>📄 Terms & Conditions</span>
            </Link>
            <a href="mailto:support@streamly.app" className="mobile-nav-link contact-link">
              <span>✉️ Contact Support</span>
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
