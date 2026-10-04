/**
 * Streamly — VideoPlayer Component
 *
 * Cinematic video player for the laptop mode.
 * Uses React refs to avoid re-rendering on every playback update.
 * Keyboard shortcuts: Space (play/pause), ← (−10s), → (+10s), F (fullscreen), M (mute)
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { formatTime } from '../services/transfer.js';

export default function VideoPlayer({
  videoUrl,
  videoMeta,
  onPlaybackStateChange,
  controlMessages,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef(null);

  // Report playback state to parent (for remote control sync)
  const reportState = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    onPlaybackStateChange?.({
      type: 'state',
      currentTime: video.currentTime,
      duration: video.duration || 0,
      paused: video.paused,
      volume: video.volume,
      muted: video.muted,
    });
  }, [onPlaybackStateChange]);

  // Set up video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const onDurationChange = () => {
      setDuration(video.duration);
    };

    const onPlay = () => {
      setIsPlaying(true);
      reportState();
    };

    const onPause = () => {
      setIsPlaying(false);
      reportState();
    };

    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
      reportState();
    };

    const onSeeked = () => {
      reportState();
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [videoUrl, reportState]);

  // Periodically report state for remote sync
  useEffect(() => {
    const interval = setInterval(reportState, 1000);
    return () => clearInterval(interval);
  }, [reportState]);

  // Handle incoming control messages from phone
  useEffect(() => {
    if (!controlMessages) return;
    const video = videoRef.current;
    if (!video) return;

    const { type, time, value } = controlMessages;

    switch (type) {
      case 'play':
        video.play().catch(() => {});
        break;
      case 'pause':
        video.pause();
        break;
      case 'seek':
        if (typeof time === 'number' && isFinite(time)) {
          video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
        }
        break;
      case 'volume':
        if (typeof value === 'number') {
          video.volume = Math.max(0, Math.min(1, value));
        }
        break;
      case 'mute':
        video.muted = !!value;
        break;
    }
  }, [controlMessages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (video.paused) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          video.muted = !video.muted;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-hide controls in fullscreen
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isFullscreen) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isFullscreen]);

  // Fullscreen change detection
  useEffect(() => {
    const handleFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar) return;

    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    video.currentTime = fraction * (video.duration || 0);
  };

  const seekRelative = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    if (val > 0 && video.muted) {
      video.muted = false;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`player-container ${isFullscreen ? 'fullscreen' : ''}`}
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      id="video-player"
    >
      {/* Video title */}
      {videoMeta?.name && !isFullscreen && (
        <div style={{
          padding: '12px 20px',
          fontSize: '0.9rem',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.8)',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {videoMeta.name}
        </div>
      )}

      {/* Video element */}
      <div className="video-wrapper" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          preload="metadata"
          style={{ background: '#000' }}
        />
        {!isPlaying && (
          <div className="video-overlay visible">
            <div className="play-icon-large">▶</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className="player-controls"
        style={{ opacity: showControls || !isFullscreen ? 1 : 0, transition: 'opacity 0.3s' }}
      >
        {/* Progress bar */}
        <div
          className="progress-bar-container"
          ref={progressRef}
          onClick={handleSeek}
        >
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="progress-bar-thumb"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="controls-row">
          <div className="controls-left">
            <button
              className="control-btn play-pause"
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              id="play-pause-btn"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            <button
              className="control-btn"
              onClick={() => seekRelative(-10)}
              title="Back 10 seconds"
              id="seek-back-btn"
            >
              ⏪
            </button>

            <button
              className="control-btn"
              onClick={() => seekRelative(10)}
              title="Forward 10 seconds"
              id="seek-forward-btn"
            >
              ⏩
            </button>

            <span className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="controls-right">
            <div className="volume-group">
              <button
                className="control-btn"
                onClick={toggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
                id="mute-btn"
              >
                {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              <div className="volume-slider-container">
                <input
                  type="range"
                  className="volume-slider"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  id="volume-slider"
                />
              </div>
            </div>

            <button
              className="control-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              id="fullscreen-btn"
            >
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
