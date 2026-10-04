/**
 * Streamly — Lightweight, Privacy-First Analytics Helper
 * Respects Do Not Track (DNT) and local consent.
 */

const IS_PRODUCTION = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

export function trackEvent(eventName, properties = {}) {
  try {
    // Check Do Not Track header
    if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
      return;
    }

    // Check cookie consent
    const consent = localStorage.getItem('streamly-cookie-consent');
    if (consent === 'rejected') {
      return;
    }

    if (!IS_PRODUCTION) {
      // In dev mode, log events nicely for testing
      console.debug(`[Analytics Event] ${eventName}:`, properties);
      return;
    }

    // Custom lightweight tracking endpoint or window.plausible / window.gtag integration point
    if (typeof window.plausible === 'function') {
      window.plausible(eventName, { props: properties });
    }
  } catch (err) {
    // Fail silently in production
  }
}

export function trackPageView(path) {
  trackEvent('page_view', { path: path || window.location.pathname });
}
