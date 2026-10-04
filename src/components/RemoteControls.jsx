/**
 * Streamly — RemoteControls Component
 *
 * TV-remote-style controls for the phone mode.
 * Sends control messages to the laptop via WebRTC.
 */

import React from 'react';
import { formatTime } from '../services/transfer.js';

export default function RemoteControls({
  playbackState,
  onPlay,
  onPause,
  onSeek,
  onSeekRelative,
  onVolumeChange,
  onMuteToggle,
  fileName,
  onDisconnect,
}) {
  const { currentTime = 0, duration = 0, paused = true, volume = 1, muted = false } = playbackState || {};

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    onSeek?.(fraction * duration);
  };

  const handleVolumeSlider = (e) => {
    const val = parseFloat(e.target.value);
    onVolumeChange?.(val);
  };

  return (
    <div className="remote-controls animate-fade-in" id="remote-controls" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ textAlign: 'center', color: 'var(--primary-color)', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Playing on your laptop
      </div>

      {/* Now Playing */}
      <div className="remote-now-playing" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="file-name" style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fileName || 'No video'}</div>
        <div className="remote-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Progress */}
      <div className="remote-progress">
        <div className="remote-progress-track" onClick={handleProgressClick}>
          <div
            className="remote-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Controls */}
      <div className="remote-main-controls">
        <button
          className="remote-btn"
          onClick={() => onSeekRelative?.(-10)}
          title="Back 10 seconds"
          id="remote-seek-back"
        >
          −10
        </button>

        <button
          className="remote-btn play-btn"
          onClick={() => paused ? onPlay?.() : onPause?.()}
          title={paused ? 'Play' : 'Pause'}
          id="remote-play-pause"
        >
          {paused ? '▶' : '⏸'}
        </button>

        <button
          className="remote-btn"
          onClick={() => onSeekRelative?.(10)}
          title="Forward 10 seconds"
          id="remote-seek-forward"
        >
          +10
        </button>
      </div>

      {/* Volume */}
      <div className="remote-volume">
        <span
          className="remote-volume-icon"
          onClick={() => onMuteToggle?.()}
          role="button"
          tabIndex={0}
          id="remote-mute-btn"
        >
          {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </span>
        <input
          type="range"
          className="remote-volume-slider"
          min="0"
          max="1"
          step="0.05"
          value={muted ? 0 : volume}
          onChange={handleVolumeSlider}
          id="remote-volume-slider"
        />
      </div>

      {/* Disconnect */}
      <button
        className="btn btn-danger btn-sm"
        onClick={onDisconnect}
        id="disconnect-btn"
        style={{ marginTop: 8 }}
      >
        Disconnect
      </button>
    </div>
  );
}
