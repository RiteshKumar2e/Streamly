import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ connectionState }) {
  const location = useLocation();

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
        <Link to="/" className="navbar-brand" title="Streamly Home">
          <img src="/streamly.svg" alt="Streamly Logo" className="navbar-logo" />
          <span className="navbar-title">Streamly</span>
          <span className="navbar-badge">P2P Direct</span>
        </Link>

        <nav className="navbar-nav-links" aria-label="Main Navigation">
          <Link
            to="/phone"
            className={`navbar-link ${location.pathname === '/phone' ? 'active' : ''}`}
            id="nav-link-phone"
          >
            <span className="nav-icon">📱</span>
            <span>Connect Phone</span>
          </Link>
          <Link
            to="/laptop"
            className={`navbar-link ${location.pathname === '/laptop' ? 'active' : ''}`}
            id="nav-link-laptop"
          >
            <span className="nav-icon">💻</span>
            <span>Connect Laptop</span>
          </Link>
        </nav>
      </div>

      <div className="navbar-actions">
        {statusLabel && (
          <div className="navbar-status">
            <div className={`status-dot ${getStatusClass()}`} />
            <span>{statusLabel}</span>
          </div>
        )}
      </div>
    </header>
  );
}
