'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('streamly-cookie-consent');
      if (!consent) {
        // Small delay for smooth entrance
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('streamly-cookie-consent', 'accepted');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    try {
      localStorage.setItem('streamly-cookie-consent', 'essential');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner-overlay" role="region" aria-label="Cookie and Privacy Preferences">
      <div className="cookie-banner">
        <div className="cookie-banner-content">
          <div className="cookie-banner-icon">🍪</div>
          <div className="cookie-banner-text">
            <h4>Privacy & Local Storage</h4>
            <p>
              Streamly is 100% peer-to-peer. We do not store your movies or sell your data. We use local storage only to remember pairing sessions and your essential device preferences.{' '}
              <Link href="/privacy" className="cookie-banner-link">
                Read Privacy Policy
              </Link>
            </p>
          </div>
        </div>

        <div className="cookie-banner-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleEssentialOnly}
            id="cookie-essential-btn"
          >
            Essential Only
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAccept}
            id="cookie-accept-btn"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
