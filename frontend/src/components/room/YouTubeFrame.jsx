import { useLayoutEffect, useRef } from 'react';
import { YouTubeMedia } from '../../lib/youtube.js';

/**
 * Hosts a YouTube player and exposes it through `mediaRef` as a <video>-like object, so the
 * sync hooks and controls work unchanged. Remount (via `key`) for a different URL.
 */
export default function YouTubeFrame({ url, mediaRef, onLoadedMetadata, onPlaying, onEnded }) {
  const hostRef = useRef(null);
  const handlers = useRef({});
  handlers.current = { loadedmetadata: onLoadedMetadata, playing: onPlaying, ended: onEnded };

  // Layout effect: the adapter must be in mediaRef before the parent's effects read it.
  useLayoutEffect(() => {
    const media = new YouTubeMedia(hostRef.current, url);
    const listeners = Object.keys(handlers.current).map((type) => {
      const fn = () => handlers.current[type]?.();
      media.addEventListener(type, fn);
      return [type, fn];
    });
    mediaRef.current = media;
    return () => {
      listeners.forEach(([type, fn]) => media.removeEventListener(type, fn));
      media.destroy();
      if (mediaRef.current === media) mediaRef.current = null;
    };
  }, [url, mediaRef]);

  return <div ref={hostRef} className="stage__video stage__yt" />;
}
