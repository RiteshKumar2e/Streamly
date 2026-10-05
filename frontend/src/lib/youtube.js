/**
 * YouTube support. A YouTube link is shared as a normal `{ kind: 'url' }` source; the frontend
 * detects it and plays it through the IFrame Player API wrapped in `YouTubeMedia`, which mimics
 * the subset of HTMLVideoElement that the sync hooks and controls use (currentTime, paused,
 * readyState, play(), media events …). That keeps sync, drift correction and controls identical
 * for both kinds of video.
 */

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Returns the 11-char video id for any common YouTube URL form, else null. */
export function parseYouTubeId(value) {
  let u;
  try {
    u = new URL(String(value || '').trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') {
    id = u.pathname.split('/')[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  return id && ID_RE.test(id) ? id : null;
}

export const isYouTubeUrl = (value) => parseYouTubeId(value) !== null;

/** Optional start offset from `?t=90` / `?t=1m30s` / `?start=90`. */
function parseStart(value) {
  try {
    const u = new URL(value);
    const raw = u.searchParams.get('t') || u.searchParams.get('start');
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Number(raw);
    const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0;
  } catch {
    return 0;
  }
}

let apiPromise = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube player failed to load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

// YT.PlayerState
const S = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

const ERRORS = {
  2: 'This YouTube link looks invalid.',
  5: 'This YouTube video can’t be played in the browser player.',
  100: 'This YouTube video was removed or is private.',
  101: 'The owner of this YouTube video doesn’t allow it to be played on other sites.',
  150: 'The owner of this YouTube video doesn’t allow it to be played on other sites.',
};

function makeError(name, message) {
  const err = new Error(message);
  err.name = name;
  return err;
}

export class YouTubeMedia extends EventTarget {
  constructor(host, url) {
    super();
    this.url = url;
    this.videoId = parseYouTubeId(url);
    this.player = null;
    this.ready = false;
    this.destroyed = false;
    this.state = S.UNSTARTED;
    this.error = null;
    this.title = '';
    this._wantPlay = false;
    this._seekTarget = null;
    this._volume = 1;
    this._muted = false;
    this._rate = 1;
    this._pendingPlays = [];
    this._lastDuration = NaN;
    this._poll = null;

    const mount = document.createElement('div');
    host.appendChild(mount);
    loadApi()
      .then((YT) => {
        if (this.destroyed) return;
        this.player = new YT.Player(mount, {
          videoId: this.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            start: Math.floor(parseStart(url)),
            origin: window.location.origin,
          },
          events: {
            onReady: () => this._onReady(),
            onStateChange: (e) => this._onState(e.data),
            onError: (e) => this._onError(e.data),
            onPlaybackRateChange: () => this._emit('ratechange'),
          },
        });
      })
      .catch((err) => {
        if (this.destroyed) return;
        this.error = { code: 2, message: err.message };
        this._emit('error');
      });
    this._emit('loadstart');
  }

  // ---- HTMLMediaElement-like surface ----
  get currentTime() {
    if (this._seekTarget !== null) return this._seekTarget;
    return this.ready ? this.player.getCurrentTime() || 0 : 0;
  }

  set currentTime(t) {
    if (!this.ready) return;
    const target = Math.max(0, Number(t) || 0);
    this._seekTarget = target;
    this._emit('seeking');
    this.player.seekTo(target, true);
    // YouTube has no "seeked" event; treat the next stable state (or a short timeout) as done.
    clearTimeout(this._seekTimer);
    this._seekTimer = setTimeout(() => this._finishSeek(), 1200);
  }

  get seeking() {
    return this._seekTarget !== null;
  }

  get duration() {
    const d = this.ready ? this.player.getDuration() : 0;
    return d > 0 ? d : NaN;
  }

  get paused() {
    return !this._wantPlay;
  }

  get ended() {
    return this.state === S.ENDED;
  }

  get readyState() {
    if (!this.ready || this.error) return 0;
    if (this.state === S.BUFFERING || this._seekTarget !== null) return 2;
    return 4;
  }

  get playbackRate() {
    return this._rate;
  }

  set playbackRate(r) {
    const rate = Number(r) || 1;
    this._rate = rate;
    // YouTube rounds to its supported rates, so tiny drift nudges (±5%) are effectively ignored and
    // drift correction falls back to seeking — that's fine.
    if (this.ready) this.player.setPlaybackRate(rate);
  }

  get volume() {
    return this._volume;
  }

  set volume(v) {
    this._volume = Math.min(1, Math.max(0, Number(v) || 0));
    if (this.ready) this.player.setVolume(Math.round(this._volume * 100));
    this._emit('volumechange');
  }

  get muted() {
    return this._muted;
  }

  set muted(m) {
    this._muted = !!m;
    if (this.ready) (this._muted ? this.player.mute() : this.player.unMute());
    this._emit('volumechange');
  }

  get buffered() {
    const end = this.ready ? (this.player.getVideoLoadedFraction() || 0) * (this.duration || 0) : 0;
    return {
      length: end > 0 ? 1 : 0,
      start: () => 0,
      end: () => end,
    };
  }

  getAttribute(name) {
    return name === 'src' ? this.url : null;
  }

  play() {
    this._wantPlay = true;
    this._emit('play');
    if (!this.ready) return Promise.resolve();
    if (this.state === S.PLAYING) return Promise.resolve();
    this.player.playVideo();
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject };
      this._pendingPlays.push(entry);
      // If playback never starts, the browser blocked autoplay (YouTube stays unstarted).
      entry.timer = setTimeout(() => {
        if (this.state !== S.PLAYING && this.state !== S.BUFFERING) this._rejectPlays('NotAllowedError');
      }, 3000);
    });
  }

  pause() {
    const was = this._wantPlay;
    this._wantPlay = false;
    this._rejectPlays('AbortError');
    if (this.ready) this.player.pauseVideo();
    if (was) this._emit('pause');
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this._poll);
    clearTimeout(this._seekTimer);
    this._rejectPlays('AbortError');
    try {
      this.player?.destroy();
    } catch {
      /* ignore */
    }
    this.player = null;
    this.ready = false;
  }

  // ---- internals ----
  _emit(type) {
    this.dispatchEvent(new Event(type));
  }

  _onReady() {
    if (this.destroyed) return;
    this.ready = true;
    this.player.setVolume(Math.round(this._volume * 100));
    if (this._muted) this.player.mute();
    else this.player.unMute();
    if (this._rate !== 1) this.player.setPlaybackRate(this._rate);
    this.title = this.player.getVideoData?.()?.title || '';
    this._emit('loadedmetadata');
    this._emit('durationchange');
    this._emit('canplay');
    if (this._wantPlay) this.player.playVideo();
    this._poll = setInterval(() => {
      if (!this.ready) return;
      const d = this.duration;
      if (d !== this._lastDuration && !(Number.isNaN(d) && Number.isNaN(this._lastDuration))) {
        this._lastDuration = d;
        this._emit('durationchange');
      }
      this._emit('timeupdate');
      this._emit('progress');
    }, 250);
  }

  _finishSeek() {
    clearTimeout(this._seekTimer);
    if (this._seekTarget === null) return;
    this._seekTarget = null;
    this._emit('seeked');
    this._emit('timeupdate');
  }

  _rejectPlays(name) {
    const list = this._pendingPlays;
    this._pendingPlays = [];
    list.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(makeError(name, name === 'NotAllowedError' ? 'Autoplay was blocked' : 'Playback interrupted'));
    });
    if (name === 'NotAllowedError') this._wantPlay = false;
  }

  _onState(state) {
    this.state = state;
    if (!this.title) this.title = this.player?.getVideoData?.()?.title || '';
    switch (state) {
      case S.PLAYING: {
        this._finishSeek();
        const list = this._pendingPlays;
        this._pendingPlays = [];
        list.forEach((p) => {
          clearTimeout(p.timer);
          p.resolve();
        });
        if (!this._wantPlay) {
          this._wantPlay = true;
          this._emit('play');
        }
        this._emit('playing');
        break;
      }
      case S.BUFFERING:
        this._emit('waiting');
        break;
      case S.PAUSED:
        this._finishSeek();
        // A pause we didn't ask for while a play() is pending = autoplay was blocked.
        if (this._pendingPlays.length) this._rejectPlays('NotAllowedError');
        if (this._wantPlay) {
          this._wantPlay = false;
          this._emit('pause');
        }
        break;
      case S.ENDED:
        this._finishSeek();
        this._wantPlay = false;
        this._emit('pause');
        this._emit('ended');
        break;
      case S.CUED:
        this._emit('canplay');
        break;
      default:
        break;
    }
  }

  _onError(code) {
    this.error = { code, message: ERRORS[code] || 'This YouTube video couldn’t be played.' };
    this._rejectPlays('AbortError');
    this._emit('error');
  }
}
