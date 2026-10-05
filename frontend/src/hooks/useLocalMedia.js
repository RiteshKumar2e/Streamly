import { useCallback, useEffect, useRef, useState } from 'react';

const VIDEO = { width: 640, height: 360 };
const AUDIO = { echoCancellation: true, noiseSuppression: true };

/**
 * Camera and microphone are OFF until the user turns them on. Turning one on asks the browser for
 * that device only; turning it off stops the track (so the camera light goes off too).
 *
 * - stream: a new MediaStream with the current local tracks (for the self preview), or null.
 * - tracks: { audio, video } current local tracks (null when off) — the peer connection sends these.
 * - sendStream: a stable MediaStream id used to group our tracks on the other side.
 * - error: null | 'denied' | 'no-camera' | 'no-mic' | 'unsupported' | 'busy'
 */
export default function useLocalMedia() {
  const [tracks, setTracks] = useState({ audio: null, video: null });
  const [pending, setPending] = useState({ audio: false, video: false });
  const [error, setError] = useState(null);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const sendStreamRef = useRef(null);
  if (!sendStreamRef.current && typeof MediaStream !== 'undefined') sendStreamRef.current = new MediaStream();
  const unmountedRef = useRef(false);

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const stopKind = useCallback((kind) => {
    const track = tracksRef.current[kind];
    if (!track) return;
    track.onended = null;
    track.stop();
    sendStreamRef.current?.removeTrack(track);
    setTracks((t) => ({ ...t, [kind]: null }));
  }, []);

  const startKind = useCallback(
    async (kind) => {
      if (!supported) {
        setError('unsupported');
        return;
      }
      if (pendingRef.current[kind] || tracksRef.current[kind]) return;
      setPending((p) => ({ ...p, [kind]: true }));
      try {
        const media = await navigator.mediaDevices.getUserMedia(kind === 'video' ? { video: VIDEO } : { audio: AUDIO });
        const track = kind === 'video' ? media.getVideoTracks()[0] : media.getAudioTracks()[0];
        if (unmountedRef.current || !track) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        // Device unplugged or permission revoked mid-call.
        track.onended = () => {
          sendStreamRef.current?.removeTrack(track);
          setTracks((t) => (t[kind] === track ? { ...t, [kind]: null } : t));
        };
        sendStreamRef.current?.addTrack(track);
        setTracks((t) => ({ ...t, [kind]: track }));
        setError(null);
      } catch (err) {
        const name = err?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') setError('denied');
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') setError(kind === 'video' ? 'no-camera' : 'no-mic');
        else if (name === 'NotReadableError') setError('busy');
        else setError(kind === 'video' ? 'no-camera' : 'no-mic');
      } finally {
        if (!unmountedRef.current) setPending((p) => ({ ...p, [kind]: false }));
      }
    },
    [supported]
  );

  const toggleCam = useCallback(() => {
    if (tracksRef.current.video) stopKind('video');
    else startKind('video');
  }, [startKind, stopKind]);

  const toggleMic = useCallback(() => {
    if (tracksRef.current.audio) stopKind('audio');
    else startKind('audio');
  }, [startKind, stopKind]);

  // Release devices on unmount.
  useEffect(
    () => () => {
      unmountedRef.current = true;
      Object.values(tracksRef.current).forEach((t) => {
        if (t) {
          t.onended = null;
          t.stop();
        }
      });
    },
    []
  );

  const live = [tracks.video, tracks.audio].filter(Boolean);
  // New object whenever tracks change, so the preview <video> re-attaches.
  const [stream, setStream] = useState(null);
  useEffect(() => {
    setStream(live.length ? new MediaStream(live) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.video, tracks.audio]);

  return {
    stream,
    tracks,
    sendStream: sendStreamRef.current,
    ready: true,
    error,
    supported,
    cam: !!tracks.video,
    mic: !!tracks.audio,
    camPending: pending.video,
    micPending: pending.audio,
    toggleCam,
    toggleMic,
  };
}
