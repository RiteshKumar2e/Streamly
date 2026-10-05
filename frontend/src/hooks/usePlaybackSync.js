import { useCallback, useEffect, useRef, useState } from 'react';
import { emitWithAck } from '../lib/socket.js';
import {
  DRIFT_INTERVAL_MS,
  DRIFT_NUDGE_S,
  DRIFT_SEEK_S,
  EMPTY_STATE,
  NUDGE_FACTOR,
  SEEK_TOLERANCE_S,
  describeAction,
  expectedTime,
  fileMatchesSource,
  normalizeState,
  reduceAction,
  sourceKey,
  titleFromFileName,
  titleFromUrl,
} from '../lib/sync.js';

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Keeps the local <video> in sync with the shared room PlaybackState.
 *
 * Echo-loop safety: we NEVER emit from native media events. Only explicit user actions
 * (the functions returned here) emit `sync:action`. Remote actions and drift correction
 * only touch the <video> element programmatically.
 */
export default function usePlaybackSync({ socket, joinInfo, serverNow, videoRef }) {
  const stateRef = useRef(EMPTY_STATE);
  const [source, setSource] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [sourceBy, setSourceBy] = useState(null);
  const [localFile, setLocalFile] = useState(null); // { file, url }
  const localFileRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const blockedRef = useRef(false);
  const [activity, setActivity] = useState(null);
  const activityTimer = useRef(null);
  const baseRateRef = useRef(1);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const serverNowRef = useRef(serverNow);
  serverNowRef.current = serverNow;

  const setBlocked = useCallback((value) => {
    blockedRef.current = value;
    setAutoplayBlocked(value);
  }, []);

  const replaceLocalFile = useCallback((file) => {
    const prev = localFileRef.current;
    if (prev) URL.revokeObjectURL(prev.url);
    const next = file ? { file, url: URL.createObjectURL(file) } : null;
    localFileRef.current = next;
    setLocalFile(next);
    return next;
  }, []);

  const commitState = useCallback(
    (next) => {
      const prevKey = sourceKey(stateRef.current.source);
      stateRef.current = next;
      setPlaying(next.playing);
      setRate(next.rate);
      const nextKey = sourceKey(next.source);
      setSource((prev) => (sourceKey(prev) === nextKey ? prev : next.source));
      if (nextKey !== prevKey) {
        // Drop a local file that doesn't belong to the new source.
        const lf = localFileRef.current;
        if (lf && !fileMatchesSource(lf.file, next.source)) replaceLocalFile(null);
        setBlocked(false);
      }
    },
    [replaceLocalFile, setBlocked]
  );

  const playVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    let p;
    try {
      p = v.play();
    } catch (err) {
      if (err?.name === 'NotAllowedError') setBlocked(true);
      return;
    }
    if (p && typeof p.then === 'function') {
      p.then(() => setBlocked(false)).catch((err) => {
        if (err?.name === 'NotAllowedError') setBlocked(true);
      });
    }
  }, [videoRef, setBlocked]);

  /** Bring the <video> to the current room state. Never emits. */
  const applyToVideo = useCallback(
    (force = false) => {
      const v = videoRef.current;
      const st = stateRef.current;
      if (!v || !st.source || v.readyState < 1) return;
      baseRateRef.current = st.rate || 1;
      if (v.playbackRate !== baseRateRef.current) v.playbackRate = baseRateRef.current;
      const dur = v.duration;
      let target = expectedTime(st, serverNowRef.current());
      const atEnd = Number.isFinite(dur) && target >= dur - 0.05;
      if (Number.isFinite(dur)) target = Math.min(target, dur);
      const diff = Math.abs(v.currentTime - target);
      if ((force && diff > 0.05) || diff > SEEK_TOLERANCE_S) v.currentTime = target;
      if (st.playing && !atEnd) {
        if (v.paused && !blockedRef.current) playVideo();
      } else if (!v.paused) {
        v.pause();
      }
    },
    [videoRef, playVideo]
  );

  const showActivity = useCallback((text) => {
    if (!text) return;
    setActivity({ id: `${Date.now()}-${Math.random()}`, text });
    clearTimeout(activityTimer.current);
    activityTimer.current = setTimeout(() => setActivity(null), 3800);
  }, []);

  /** Local user action: update local state, emit to the room, then apply. */
  const dispatch = useCallback(
    (action) => {
      const next = reduceAction(stateRef.current, action, serverNowRef.current());
      commitState(next);
      const s = socketRef.current;
      if (s?.connected) s.emit('sync:action', action);
    },
    [commitState]
  );

  // Incoming remote actions — apply without re-emitting.
  useEffect(() => {
    if (!socket) return undefined;
    const onAction = (action) => {
      if (!action?.type) return;
      const at = typeof action.serverTime === 'number' ? action.serverTime : serverNowRef.current();
      const next = reduceAction(stateRef.current, action, at);
      if (action.type === 'source') setSourceBy(action.name || 'Your friend');
      commitState(next);
      applyToVideo(action.type === 'seek' || action.type === 'pause');
      showActivity(describeAction(action));
    };
    socket.on('sync:action', onAction);
    return () => socket.off('sync:action', onAction);
  }, [socket, commitState, applyToVideo, showActivity]);

  // Every (re)join: adopt the authoritative state from the ack.
  useEffect(() => {
    if (!joinInfo) return;
    commitState(normalizeState(joinInfo.state));
    applyToVideo(true);
  }, [joinInfo, commitState, applyToVideo]);

  // Refresh state when the tab becomes visible again (timers may have been throttled).
  useEffect(() => {
    const onVis = async () => {
      const s = socketRef.current;
      if (document.visibilityState !== 'visible' || !s?.connected || !joinInfo) return;
      try {
        const st = await emitWithAck(s, 'sync:request', undefined, 5000);
        if (st && typeof st === 'object') {
          commitState(normalizeState(st));
          applyToVideo(false);
        }
      } catch {
        /* ignore */
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [joinInfo, commitState, applyToVideo]);

  // Drift correction loop.
  useEffect(() => {
    const id = setInterval(() => {
      const v = videoRef.current;
      const st = stateRef.current;
      if (!v || !st.source || v.readyState < 1 || v.seeking) return;
      const base = st.rate || 1;
      const dur = v.duration;
      const expected = expectedTime(st, serverNowRef.current());
      if (Number.isFinite(dur) && expected >= dur - 0.25) {
        if (v.playbackRate !== base) v.playbackRate = base;
        return;
      }
      if (!st.playing) {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - expected) > 0.5) v.currentTime = expected;
        return;
      }
      if (v.paused) {
        if (!blockedRef.current) {
          if (Math.abs(v.currentTime - expected) > DRIFT_SEEK_S) v.currentTime = expected;
          playVideo();
        }
        return;
      }
      if (v.readyState < 3) return; // buffering: let it catch up afterwards
      const drift = v.currentTime - expected;
      const abs = Math.abs(drift);
      if (abs > DRIFT_SEEK_S) {
        v.currentTime = expected;
        v.playbackRate = base;
      } else if (abs > DRIFT_NUDGE_S) {
        v.playbackRate = base * (drift > 0 ? 1 - NUDGE_FACTOR : 1 + NUDGE_FACTOR);
      } else if (v.playbackRate !== base) {
        v.playbackRate = base;
      }
    }, DRIFT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [videoRef, playVideo]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      clearTimeout(activityTimer.current);
      if (localFileRef.current) URL.revokeObjectURL(localFileRef.current.url);
      localFileRef.current = null;
    },
    []
  );

  // ---------- user actions ----------
  const position = useCallback(() => {
    const v = videoRef.current;
    if (v && v.readyState >= 1) return v.currentTime;
    return expectedTime(stateRef.current, serverNowRef.current());
  }, [videoRef]);

  const duration = useCallback(() => {
    const d = videoRef.current?.duration;
    return Number.isFinite(d) ? d : null;
  }, [videoRef]);

  const play = useCallback(() => {
    const st = stateRef.current;
    if (!st.source) return;
    if (st.playing) {
      // Room is already playing (e.g. autoplay was blocked): just resume locally.
      setBlocked(false);
      applyToVideo(false);
      playVideo();
      return;
    }
    let t = position();
    const d = duration();
    if (d && t >= d - 0.5) t = 0;
    dispatch({ type: 'play', time: round3(t) });
    applyToVideo(false);
  }, [dispatch, applyToVideo, playVideo, position, duration, setBlocked]);

  const pause = useCallback(() => {
    if (!stateRef.current.source || !stateRef.current.playing) return;
    dispatch({ type: 'pause', time: round3(position()) });
    applyToVideo(true);
  }, [dispatch, applyToVideo, position]);

  const togglePlay = useCallback(() => {
    if (stateRef.current.playing && !blockedRef.current) pause();
    else play();
  }, [play, pause]);

  const seekTo = useCallback(
    (time) => {
      if (!stateRef.current.source) return;
      const d = duration();
      let t = Math.max(0, Number(time) || 0);
      if (d) t = Math.min(t, Math.max(0, d - 0.1));
      dispatch({ type: 'seek', time: round3(t) });
      applyToVideo(true);
    },
    [dispatch, applyToVideo, duration]
  );

  const seekBy = useCallback((delta) => seekTo(position() + delta), [seekTo, position]);

  const setSpeed = useCallback(
    (r) => {
      if (!stateRef.current.source) return;
      dispatch({ type: 'rate', rate: Number(r) || 1, time: round3(position()) });
      applyToVideo(false);
    },
    [dispatch, applyToVideo, position]
  );

  const loadUrl = useCallback(
    (url, title) => {
      const clean = String(url || '').trim();
      if (!clean) return;
      setSourceBy('You');
      dispatch({ type: 'source', source: { kind: 'url', url: clean, title: title || titleFromUrl(clean) } });
    },
    [dispatch]
  );

  /** Pick a local file AND announce it to the room as the new source. */
  const chooseFile = useCallback(
    (file) => {
      if (!file) return;
      replaceLocalFile(file);
      setSourceBy('You');
      dispatch({
        type: 'source',
        source: { kind: 'file', name: file.name, size: file.size, title: titleFromFileName(file.name) },
      });
    },
    [dispatch, replaceLocalFile]
  );

  /** Provide the local copy of the file the room is already using (no emit). */
  const provideFile = useCallback(
    (file) => {
      if (!file) return;
      setBlocked(false);
      replaceLocalFile(file);
    },
    [replaceLocalFile, setBlocked]
  );

  const resumePlayback = useCallback(() => {
    setBlocked(false);
    applyToVideo(false);
    playVideo();
  }, [applyToVideo, playVideo, setBlocked]);

  const onLoadedMetadata = useCallback(() => applyToVideo(true), [applyToVideo]);

  /** Playback (re)started after loading/buffering: catch up right away instead of on the next drift tick. */
  const onPlaying = useCallback(() => {
    const v = videoRef.current;
    const st = stateRef.current;
    if (!v || !st.source || !st.playing || v.seeking) return;
    const expected = expectedTime(st, serverNowRef.current());
    // Same threshold as drift correction, so a seek's own landing point can't trigger another seek.
    if (Math.abs(v.currentTime - expected) > DRIFT_SEEK_S) v.currentTime = expected;
  }, [videoRef]);

  const onEnded = useCallback(() => {
    const v = videoRef.current;
    const st = stateRef.current;
    // Natural end of media (not a programmatic change): park the room at the end.
    if (v && st.playing && Number.isFinite(v.duration)) {
      const expected = expectedTime(st, serverNowRef.current());
      if (expected >= v.duration - 2) dispatch({ type: 'pause', time: round3(v.duration) });
    }
  }, [videoRef, dispatch]);

  const src =
    source?.kind === 'url' ? source.url : source?.kind === 'file' && localFile ? localFile.url : null;
  const needsFile = source?.kind === 'file' && !localFile;
  const fileMismatch = source?.kind === 'file' && !!localFile && !fileMatchesSource(localFile.file, source);

  return {
    source,
    sourceBy,
    playing,
    rate,
    src,
    localFile,
    needsFile,
    fileMismatch,
    autoplayBlocked,
    activity,
    play,
    pause,
    togglePlay,
    seekTo,
    seekBy,
    setSpeed,
    loadUrl,
    chooseFile,
    provideFile,
    resumePlayback,
    onLoadedMetadata,
    onPlaying,
    onEnded,
  };
}
