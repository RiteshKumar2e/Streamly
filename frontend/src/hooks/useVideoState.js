import { useEffect, useState } from 'react';

const INITIAL = { current: 0, duration: 0, buffered: 0, paused: true, waiting: false, error: null, ready: false };

function bufferedEnd(v) {
  const b = v.buffered;
  if (!b || b.length === 0) return 0;
  const t = v.currentTime;
  for (let i = 0; i < b.length; i += 1) {
    if (b.start(i) <= t + 0.5 && b.end(i) >= t) return b.end(i);
  }
  return b.end(b.length - 1);
}

/** Read-only view of a <video> element's state for UI rendering (never emits sync actions). */
export default function useVideoState(videoRef, src) {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const read = (extra = {}) =>
      setState((prev) => ({
        ...prev,
        current: v.currentTime || 0,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        buffered: bufferedEnd(v),
        paused: v.paused,
        ready: v.readyState >= 1,
        ...extra,
      }));

    const onWaiting = () => read({ waiting: true });
    const onPlaying = () => read({ waiting: false });
    const onCanPlay = () => read({ waiting: false });
    const onError = () => {
      if (!v.getAttribute('src')) return;
      const code = v.error?.code;
      read({
        waiting: false,
        error: v.error?.message
          ? v.error.message
          : code === 4
            ? 'This video format or link isn’t supported by your browser.'
            : code === 2
              ? 'A network error interrupted the video.'
              : 'The video couldn’t be loaded.',
      });
    };
    const onEmptied = () => setState({ ...INITIAL });
    const onLoadStart = () => read({ error: null, waiting: !!v.getAttribute('src') });
    const generic = () => read();

    const map = {
      timeupdate: generic,
      durationchange: generic,
      loadedmetadata: generic,
      progress: generic,
      play: generic,
      pause: generic,
      seeking: generic,
      seeked: generic,
      ended: generic,
      waiting: onWaiting,
      playing: onPlaying,
      canplay: onCanPlay,
      error: onError,
      emptied: onEmptied,
      loadstart: onLoadStart,
    };
    Object.entries(map).forEach(([e, fn]) => v.addEventListener(e, fn));
    read();
    return () => Object.entries(map).forEach(([e, fn]) => v.removeEventListener(e, fn));
  }, [videoRef, src]);

  return state;
}
