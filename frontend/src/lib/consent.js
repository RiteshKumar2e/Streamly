import { useEffect, useState } from 'react';

const KEY = 'streamly:consent'; // 'accepted' | 'declined'
const EVENT = 'streamly:consent-change';
const OPEN_EVENT = 'streamly:consent-open';

export function readConsent() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* storage blocked: choice lasts for this page view only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

/** Re-open the banner (footer "Cookie settings" link). */
export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function useConsent() {
  const [consent, setState] = useState(readConsent);
  const [forcedOpen, setForcedOpen] = useState(false);
  useEffect(() => {
    const onChange = (e) => {
      setState(e.detail);
      setForcedOpen(false);
    };
    const onOpen = () => setForcedOpen(true);
    window.addEventListener(EVENT, onChange);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);
  return { consent, showBanner: consent === null || forcedOpen };
}

/** Browser-level "Do Not Track" / Global Privacy Control opt-out. */
export function browserOptedOut() {
  return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
}
