import { useCallback, useEffect, useRef, useState } from 'react';

const VIDEO = { width: 640, height: 360 };
const AUDIO = { echoCancellation: true, noiseSuppression: true };

/**
 * Acquires the local camera + microphone once.
 * ready=true once the attempt has settled (success or failure) — the peer connection waits for it.
 * error: null | 'denied' | 'unavailable' | 'unsupported' | 'no-camera' | 'no-mic'
 */
export default function useLocalMedia() {
  const [stream, setStream] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [cam, setCam] = useState(false);
  const [mic, setMic] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let acquired = null;

    (async () => {
      const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
      if (!md?.getUserMedia) {
        setError('unsupported');
        setReady(true);
        return;
      }
      const attempts = [{ video: VIDEO, audio: AUDIO }, { audio: AUDIO }, { video: VIDEO }];
      let lastErr = null;
      for (const constraints of attempts) {
        try {
          acquired = await md.getUserMedia(constraints);
          break;
        } catch (err) {
          lastErr = err;
          if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') break;
        }
      }
      if (cancelled) {
        acquired?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!acquired) {
        const denied = lastErr?.name === 'NotAllowedError' || lastErr?.name === 'SecurityError';
        setError(denied ? 'denied' : 'unavailable');
        setReady(true);
        return;
      }
      const hasVideo = acquired.getVideoTracks().length > 0;
      const hasAudio = acquired.getAudioTracks().length > 0;
      streamRef.current = acquired;
      setStream(acquired);
      setCam(hasVideo);
      setMic(hasAudio);
      setError(!hasVideo ? 'no-camera' : !hasAudio ? 'no-mic' : null);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleCam = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCam(track.enabled);
  }, []);

  const toggleMic = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMic(track.enabled);
  }, []);

  const hasCamTrack = !!stream && stream.getVideoTracks().length > 0;
  const hasMicTrack = !!stream && stream.getAudioTracks().length > 0;

  return { stream, ready, error, cam, mic, hasCamTrack, hasMicTrack, toggleCam, toggleMic };
}
