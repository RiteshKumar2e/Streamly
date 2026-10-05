import { useEffect, useRef, useState } from 'react';
import { SPEEDS, formatRate, formatTime } from '../../lib/sync.js';
import {
  IconBack10,
  IconExitFullscreen,
  IconFullscreen,
  IconFwd10,
  IconMute,
  IconPause,
  IconPlay,
  IconVolume,
  IconVolumeLow,
} from './icons.jsx';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function PlayerControls({
  vstate,
  sync,
  volume,
  muted,
  onVolume,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  onMenuChange,
  disabled,
}) {
  const { current, duration, buffered } = vstate;
  const trackRef = useRef(null);
  const [scrub, setScrub] = useState(null);
  const [hover, setHover] = useState(null);
  const [speedOpen, setSpeedOpen] = useState(false);
  const speedRef = useRef(null);

  useEffect(() => {
    onMenuChange?.(speedOpen || scrub !== null);
  }, [speedOpen, scrub, onMenuChange]);

  useEffect(() => {
    if (!speedOpen) return undefined;
    const close = (e) => {
      if (speedRef.current && !speedRef.current.contains(e.target)) setSpeedOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setSpeedOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [speedOpen]);

  const timeAt = (clientX) => {
    const el = trackRef.current;
    if (!el || !duration) return 0;
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1) * duration;
  };

  const onPointerDown = (e) => {
    if (disabled || !duration) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setScrub(timeAt(e.clientX));
  };
  const onPointerMove = (e) => {
    if (!duration) return;
    const t = timeAt(e.clientX);
    const r = trackRef.current.getBoundingClientRect();
    setHover({ x: clamp(e.clientX - r.left, 0, r.width), time: t });
    if (scrub !== null) setScrub(t);
  };
  const onPointerUp = (e) => {
    if (scrub === null) return;
    const t = timeAt(e.clientX);
    setScrub(null);
    sync.seekTo(t);
  };
  const onTrackKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      sync.seekBy(e.key === 'ArrowLeft' ? -5 : 5);
    }
  };

  const shown = scrub ?? current;
  const pct = duration ? clamp((shown / duration) * 100, 0, 100) : 0;
  const bufPct = duration ? clamp((buffered / duration) * 100, 0, 100) : 0;
  const isPlaying = sync.playing && !sync.autoplayBlocked;
  const effectiveVolume = muted ? 0 : volume;

  return (
    <div className="player-controls" onDoubleClick={(e) => e.stopPropagation()}>
      <div
        ref={trackRef}
        className={`seek ${scrub !== null ? 'is-scrubbing' : ''} ${!duration ? 'is-disabled' : ''}`}
        role="slider"
        tabIndex={duration ? 0 : -1}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration || 0)}
        aria-valuenow={Math.round(shown || 0)}
        aria-valuetext={`${formatTime(shown)} of ${formatTime(duration)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setScrub(null)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onTrackKey}
      >
        <div className="seek__rail">
          <div className="seek__buffered" style={{ width: `${bufPct}%` }} />
          <div className="seek__played" style={{ width: `${pct}%` }} />
        </div>
        <div className="seek__thumb" style={{ left: `${pct}%` }} />
        {hover && duration > 0 && (
          <div className="seek__tooltip" style={{ left: `${hover.x}px` }}>
            {formatTime(scrub ?? hover.time)}
          </div>
        )}
      </div>

      <div className="player-controls__row">
        <div className="player-controls__group">
          <button
            type="button"
            className="ctl-btn ctl-btn--primary"
            onClick={sync.togglePlay}
            disabled={disabled}
            aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} />}
          </button>
          <button
            type="button"
            className="ctl-btn"
            onClick={() => sync.seekBy(-10)}
            disabled={disabled}
            aria-label="Back 10 seconds"
            title="Back 10s (←)"
          >
            <IconBack10 size={20} />
          </button>
          <button
            type="button"
            className="ctl-btn"
            onClick={() => sync.seekBy(10)}
            disabled={disabled}
            aria-label="Forward 10 seconds"
            title="Forward 10s (→)"
          >
            <IconFwd10 size={20} />
          </button>
          <div className="ctl-volume">
            <button
              type="button"
              className="ctl-btn"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute (M)' : 'Mute (M)'}
              title={muted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {effectiveVolume === 0 ? (
                <IconMute size={20} />
              ) : effectiveVolume < 0.5 ? (
                <IconVolumeLow size={20} />
              ) : (
                <IconVolume size={20} />
              )}
            </button>
            <input
              type="range"
              className="range ctl-volume__range"
              min="0"
              max="1"
              step="0.02"
              value={effectiveVolume}
              onChange={(e) => onVolume(Number(e.target.value))}
              aria-label="Movie volume (only for you)"
              title="Movie volume — only changes it for you"
              style={{ '--fill': `${effectiveVolume * 100}%` }}
            />
          </div>
          <span className="ctl-time">
            {formatTime(shown)} <span className="ctl-time__sep">/</span> {formatTime(duration)}
          </span>
        </div>

        <div className="player-controls__group">
          <div className="ctl-speed" ref={speedRef}>
            <button
              type="button"
              className="ctl-btn ctl-btn--text"
              onClick={() => setSpeedOpen((o) => !o)}
              disabled={disabled}
              aria-haspopup="menu"
              aria-expanded={speedOpen}
              title="Playback speed (synced)"
            >
              {formatRate(sync.rate)}
            </button>
            {speedOpen && (
              <div className="ctl-menu" role="menu">
                <div className="ctl-menu__title">Speed</div>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="menuitemradio"
                    aria-checked={sync.rate === s}
                    className={`ctl-menu__item ${sync.rate === s ? 'is-active' : ''}`}
                    onClick={() => {
                      sync.setSpeed(s);
                      setSpeedOpen(false);
                    }}
                  >
                    {s === 1 ? 'Normal' : formatRate(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="ctl-btn"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <IconExitFullscreen size={20} /> : <IconFullscreen size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
