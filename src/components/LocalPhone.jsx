'use client';

/**
 * Streamly — Phone screen for local (hotspot) mode.
 *
 * Opened from the laptop's QR code (http://<laptop-ip>:<port>/phone?session=...&local=1).
 * Uploads the movie straight to the laptop's Streamly server and acts as the remote.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import useLocalLink from '../hooks/useLocalLink.js';
import { formatBytes } from '../services/transfer.js';
import FilePicker from './FilePicker.jsx';
import RemoteControls from './RemoteControls.jsx';
import ProgressBar from './ProgressBar.jsx';
import ErrorMessage from './ErrorMessage.jsx';

const VIDEO_EXT_TYPES = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', '3gp': 'video/3gpp', ts: 'video/mp2t',
};

function videoTypeOf(file) {
  if (file.type && file.type.startsWith('video/')) return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return VIDEO_EXT_TYPES[ext] || null;
}

export default function LocalPhone({ session }) {
  const [laptopOnline, setLaptopOnline] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [hasStartedWatching, setHasStartedWatching] = useState(false);
  const [error, setError] = useState(null);
  const [playbackState, setPlaybackState] = useState({
    currentTime: 0, duration: 0, paused: true, volume: 1, muted: false,
  });
  const xhrRef = useRef(null);

  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case 'hello':
        setLaptopOnline(!!event.peerOnline);
        break;
      case 'peer-joined':
        setLaptopOnline(true);
        break;
      case 'peer-left':
        setLaptopOnline(false);
        break;
      case 'state':
        setPlaybackState((prev) => ({
          ...prev,
          currentTime: event.currentTime ?? prev.currentTime,
          duration: event.duration ?? prev.duration,
          paused: event.paused ?? prev.paused,
          volume: event.volume ?? prev.volume,
          muted: event.muted ?? prev.muted,
        }));
        break;
      case 'error':
        setError(event.message || 'Error reported by laptop');
        break;
      default:
        break;
    }
  }, []);

  const { connected: serverConnected, send } = useLocalLink(session, 'phone', handleEvent);
  const isConnected = serverConnected && laptopOnline;

  // Abort an in-flight upload if the page goes away
  useEffect(() => () => xhrRef.current?.abort(), []);

  const handleFileSelect = (file) => {
    if (!file) return;
    const type = videoTypeOf(file);
    if (!type) {
      setError('Please select a video file.');
      return;
    }
    setError(null);
    setSelectedFile({ file, type, name: file.name, size: file.size, sizeFormatted: formatBytes(file.size) });
  };

  const handleStartWatching = () => {
    if (!selectedFile) return;
    setError(null);
    setHasStartedWatching(true);
    setIsUploading(true);
    setProgress({ percent: 0, bytesSent: 0, totalBytes: selectedFile.size });

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('PUT', `/api/local/upload?session=${encodeURIComponent(session)}`);
    xhr.setRequestHeader('Content-Type', selectedFile.type);
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(selectedFile.name));

    xhr.upload.onprogress = (e) => {
      const total = e.lengthComputable ? e.total : selectedFile.size;
      setProgress({
        percent: total ? Math.round((e.loaded / total) * 100) : 0,
        bytesSent: e.loaded,
        totalBytes: total,
      });
    };
    xhr.onload = () => {
      xhrRef.current = null;
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(null);
      } else {
        let message = `Upload failed (${xhr.status})`;
        try { message = JSON.parse(xhr.responseText).error || message; } catch {}
        setError(message);
        setHasStartedWatching(false);
      }
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      setIsUploading(false);
      setHasStartedWatching(false);
      setError('Upload failed — make sure the laptop is still connected to your hotspot, then try again.');
    };
    xhr.send(selectedFile.file);
  };

  const handleDisconnect = () => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setIsUploading(false);
    setHasStartedWatching(false);
    setSelectedFile(null);
    setProgress(null);
  };

  const handleSeekRelative = (seconds) => {
    const current = playbackState.currentTime || 0;
    const duration = playbackState.duration || 0;
    send({ type: 'seek', time: Math.max(0, Math.min(duration, current + seconds)) });
  };

  return (
    <div className="mode-page" id="phone-page">
      <div className="mode-header">
        <h1>Streamly</h1>
        {!isConnected && <p>Connect to the big screen.</p>}
      </div>

      <div className="mode-content">
        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        {/* Waiting for the laptop */}
        {!isConnected && !isUploading && (
          <div className="pairing-section animate-fade-in-up">
            <div className="waiting-text" style={{ padding: '40px 0', flexDirection: 'column', gap: 16 }}>
              <div className="waiting-spinner" style={{ width: 48, height: 48 }} />
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {serverConnected ? 'Laptop page is closed' : 'Connecting to laptop...'}
              </span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 300, textAlign: 'center' }}>
                {serverConnected
                  ? 'Open Streamly on your laptop again — this page reconnects by itself.'
                  : 'Make sure the laptop is connected to this phone\'s hotspot (or the same Wi-Fi) and Streamly is running on it.'}
              </p>
            </div>
          </div>
        )}

        {/* Connected: choose a movie */}
        {isConnected && !hasStartedWatching && (
          <div className="pairing-section animate-fade-in-up">
            <div className="success-banner animate-fade-in" style={{ justifyContent: 'center', backgroundColor: 'var(--bg-card)', border: 'none', padding: '16px 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600 }}>
              <span className="success-icon" style={{ color: 'var(--success-color)' }}>✓</span>
              <span>Connected to your laptop</span>
            </div>

            <h2 style={{ fontSize: '1.4rem', marginBottom: 8, color: 'var(--text-primary)' }}>Choose a movie to watch</h2>

            <FilePicker onFileSelect={handleFileSelect} selectedFile={selectedFile} />

            {selectedFile && (
              <button className="btn btn-primary btn-lg btn-block" onClick={handleStartWatching} id="start-watching-btn">
                ▶ Start Watching
              </button>
            )}
          </div>
        )}

        {/* Uploading */}
        {hasStartedWatching && isUploading && (
          <div className="pairing-section animate-fade-in-up">
            <div style={{ textAlign: 'center', margin: '12px 0' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sending {selectedFile?.name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Sending to laptop over your local network — no mobile data used. Keep this screen on.
              </p>
            </div>
            <ProgressBar progress={progress} label="Sending video" />
            <button className="btn btn-ghost btn-sm" onClick={handleDisconnect} style={{ marginTop: 8 }}>
              Cancel
            </button>
          </div>
        )}

        {/* Remote control */}
        {hasStartedWatching && !isUploading && (
          <RemoteControls
            playbackState={playbackState}
            onPlay={() => send({ type: 'play' })}
            onPause={() => send({ type: 'pause' })}
            onSeek={(time) => send({ type: 'seek', time })}
            onSeekRelative={handleSeekRelative}
            onVolumeChange={(value) => send({ type: 'volume', value })}
            onMuteToggle={() => send({ type: 'mute', value: !playbackState.muted })}
            fileName={selectedFile?.name}
            onDisconnect={handleDisconnect}
          />
        )}
      </div>
    </div>
  );
}
