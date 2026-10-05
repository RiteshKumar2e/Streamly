import { isYouTubeUrl } from './youtube.js';
/* Pure helpers for playback synchronisation (no React, no DOM). */

export const DRIFT_INTERVAL_MS = 2000;
export const DRIFT_SEEK_S = 1.5; // above this: hard seek
export const DRIFT_NUDGE_S = 0.3; // between this and DRIFT_SEEK_S: nudge playbackRate
export const NUDGE_FACTOR = 0.05; // ±5%
export const SEEK_TOLERANCE_S = 0.35; // ignore smaller differences when applying a state
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const EMPTY_STATE = Object.freeze({
  source: null,
  playing: false,
  time: 0,
  rate: 1,
  updatedAt: 0,
});

const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function normalizeState(state) {
  const s = state || {};
  return {
    source: s.source || null,
    playing: !!s.playing,
    time: Math.max(0, num(s.time, 0)),
    rate: num(s.rate, 1) || 1,
    updatedAt: num(s.updatedAt, 0),
  };
}

/** Expected media position (seconds) at server time `serverNowMs`. */
export function expectedTime(state, serverNowMs) {
  if (!state) return 0;
  const elapsed = state.playing ? Math.max(0, (serverNowMs - state.updatedAt) / 1000) * (state.rate || 1) : 0;
  return Math.max(0, (state.time || 0) + elapsed);
}

/** Apply a SyncAction to a PlaybackState, mirroring the server's rules. */
export function reduceAction(state, action, atMs) {
  const s = normalizeState(state);
  switch (action?.type) {
    case 'play':
      return { ...s, playing: true, time: num(action.time, s.time), updatedAt: atMs };
    case 'pause':
      return { ...s, playing: false, time: num(action.time, s.time), updatedAt: atMs };
    case 'seek':
      return { ...s, time: num(action.time, s.time), updatedAt: atMs };
    case 'rate':
      return { ...s, rate: num(action.rate, s.rate) || 1, time: num(action.time, s.time), updatedAt: atMs };
    case 'source':
      return { source: action.source || null, playing: false, time: 0, rate: 1, updatedAt: atMs };
    default:
      return s;
  }
}

export function sourceKey(source) {
  if (!source) return '';
  if (source.kind === 'url') return `url:${source.url}`;
  if (source.kind === 'file') return `file:${source.name}:${source.size}`;
  return 'unknown';
}

export function fileMatchesSource(file, source) {
  return !!file && source?.kind === 'file' && file.name === source.name && file.size === source.size;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatRate(rate) {
  return `${Number(rate || 1)}×`;
}

export function titleFromFileName(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '');
  return base.replace(/[._]+/g, ' ').trim() || String(name || 'Movie');
}

export function titleFromUrl(url) {
  if (isYouTubeUrl(url)) return 'YouTube video';
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    return (last && titleFromFileName(last)) || u.hostname;
  } catch {
    return 'Video';
  }
}

/** Human readable activity line for an incoming SyncAction. */
export function describeAction(action) {
  const who = action?.name || 'Your friend';
  switch (action?.type) {
    case 'play':
      return `${who} played from ${formatTime(action.time)}`;
    case 'pause':
      return `${who} paused at ${formatTime(action.time)}`;
    case 'seek':
      return `${who} jumped to ${formatTime(action.time)}`;
    case 'rate':
      return `${who} set speed to ${formatRate(action.rate)}`;
    case 'source':
      return action.source ? `${who} loaded “${action.source.title || 'a movie'}”` : `${who} cleared the movie`;
    default:
      return '';
  }
}
