import { useEffect } from 'react';

/** Public site URL (no trailing slash). Set VITE_SITE_URL on Vercel to your real domain. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://streamly-psi-six.vercel.app').replace(/\/+$/, '');
export const SITE_NAME = 'Streamly';
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'support@streamly.app';
export const DEFAULT_DESCRIPTION =
  'Watch movies and YouTube together in perfect sync — face to face, with shared controls, private video calls and chat. Free, no sign-up.';

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    const [, key, name] = selector.match(/\[(\w+)="([^"]+)"\]/);
    el.setAttribute(key, name);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/**
 * Per-page <title>, description, canonical URL and social tags.
 * `noindex` keeps private pages (rooms) out of search engines.
 */
export function usePageMeta({ title, description = DEFAULT_DESCRIPTION, path, noindex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — Watch movies together, face to face`;
    const url = `${SITE_URL}${path ?? window.location.pathname}`;
    document.title = fullTitle;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', fullTitle);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[name="twitter:title"]', 'content', fullTitle);
    setMeta('meta[name="twitter:description"]', 'content', description);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[name="robots"]', 'content', noindex ? 'noindex, nofollow' : 'index, follow');
  }, [title, description, path, noindex]);
}
