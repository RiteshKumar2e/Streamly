import { Link } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { browserOptedOut, setConsent, useConsent } from '../../lib/consent.js';
import './CookieConsent.css';

/** Bottom banner + consent-gated Vercel Web Analytics (cookie-free, aggregated). */
export default function CookieConsent() {
  const { consent, showBanner } = useConsent();
  const analyticsOn = consent === 'accepted' && !browserOptedOut();

  return (
    <>
      {analyticsOn && (
        <Analytics
          // Room codes are private: report all rooms as one route.
          beforeSend={(event) => ({ ...event, url: event.url.replace(/\/room\/[^/?#]+/, '/room/[id]') })}
        />
      )}
      {showBanner && (
        <div className="consent" role="dialog" aria-live="polite" aria-label="Privacy choices">
          <p className="consent-text">
            We use privacy-friendly analytics (no cookies, no personal profiles) to see which pages people use.
            YouTube videos you play may set their own cookies.{' '}
            <Link to="/privacy">Privacy policy</Link>
          </p>
          <div className="consent-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConsent('declined')}>
              Decline
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setConsent('accepted')}>
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
