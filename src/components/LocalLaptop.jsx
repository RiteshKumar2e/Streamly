'use client';

/**
 * Streamly — Laptop screen for local (hotspot) mode.
 *
 * The phone opens this laptop's LAN address from the QR code and uploads the movie
 * straight to the laptop's Streamly server — no internet needed.
 */

import React, { useState, useCallback } from 'react';
import useLocalLink from '../hooks/useLocalLink.js';
import { formatBytes } from '../services/transfer.js';
import ConnectionStatus from './ConnectionStatus.jsx';
import VideoPlayer from './VideoPlayer.jsx';
import ProgressBar from './ProgressBar.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import QRCode from './QRCode.jsx';

function newSessionId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = 'stream-';
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export default function LocalLaptop({ addresses }) {
  const [sessionId] = useState(newSessionId);
  const [ipIndex, setIpIndex] = useState(0);
  const [phoneOnline, setPhoneOnline] = useState(false);
  const [incoming, setIncoming] = useState(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [progress, setProgress] = useState(null);
  const [video, setVideo] = useState(null);
  const [lastControl, setLastControl] = useState(null);
  const [error, setError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const sendRef = React.useRef(null);

  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case 'hello':
        setPhoneOnline(!!event.peerOnline);
        if (event.video) setVideo(event.video);
        break;
      case 'peer-joined':
        setPhoneOnline(true);
        break;
      case 'peer-left':
        setPhoneOnline(false);
        break;
      case 'file-info':
        setError(null);
        setVideo(null);
        setIncoming({ name: event.name, size: event.size, mimeType: event.mimeType });
        setIsTransferring(true);
        setProgress({ percent: 0, receivedBytes: 0, totalBytes: event.size });
        break;
      case 'transfer-progress':
        setIsTransferring(true);
        setProgress(event);
        break;
      case 'video-ready':
        setIsTransferring(false);
        setProgress(null);
        setVideo({ url: event.url, name: event.name, size: event.size, mimeType: event.mimeType });
        sendRef.current?.({ type: 'ready' });
        break;
      case 'transfer-error':
        setIsTransferring(false);
        setProgress(null);
        setError('Receive failed: ' + (event.message || 'upload interrupted'));
        break;
      case 'play':
      case 'pause':
      case 'seek':
      case 'volume':
      case 'mute':
        // New object every time so repeated commands (e.g. two "play"s) still apply
        setLastControl({ ...event, at: Date.now() });
        break;
      default:
        break;
    }
  }, []);

  const { connected: serverConnected, send } = useLocalLink(sessionId, 'laptop', handleEvent);
  sendRef.current = send;

  const handlePlaybackStateChange = useCallback((state) => {
    send(state);
  }, [send]);

  const address = addresses[ipIndex] || addresses[0];
  const port = typeof window !== 'undefined' ? window.location.port : '';
  const phoneUrl = address
    ? `http://${address.ip}${port ? `:${port}` : ''}/phone?session=${sessionId}&local=1`
    : '';

  const handleCopyLink = () => {
    if (!phoneUrl || !navigator.clipboard) return;
    navigator.clipboard.writeText(phoneUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(() => {});
  };

  const hasVideo = !!video;
  const videoMeta = video ? { ...video, sizeFormatted: formatBytes(video.size || 0) } : null;

  return (
    <div className="mode-page" id="laptop-page">
      {!hasVideo && (
        <div className="mode-header">
          <h1>{phoneOnline ? '✓ Phone Connected' : 'Streamly'}</h1>
          <p style={phoneOnline ? {} : { fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 420, margin: '0 auto' }}>
            {phoneOnline
              ? 'Choose a movie on your phone.'
              : 'Connect your phone to watch on the big screen.'}
          </p>
        </div>
      )}

      <div className="mode-content" style={hasVideo ? { padding: 0, justifyContent: 'flex-start' } : {}}>
        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        {/* State 1: QR code */}
        {!phoneOnline && !hasVideo && (
          <div className="pairing-section animate-fade-in-up">
            <QRCode value={phoneUrl} size={250} />

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                Scan with your phone camera
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: 380, margin: '0 auto' }}>
                Phone and laptop must be on the same network — e.g. laptop connected to the phone&apos;s hotspot.
                No internet or mobile data is used for the movie.
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 12, wordBreak: 'break-all' }}>
                Or open on phone: <strong>{phoneUrl}</strong>
              </p>
            </div>

            {addresses.length > 1 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {addresses.map((a, i) => (
                  <button
                    key={a.ip}
                    className={`btn btn-sm ${i === ipIndex ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setIpIndex(i)}
                    title={a.name}
                  >
                    {a.ip} ({a.name})
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={handleCopyLink} style={{ fontSize: '0.85rem' }}>
                {copiedLink ? '✓ Link Copied!' : '🔗 Copy Pairing Link'}
              </button>
            </div>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div className="waiting-spinner" />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {serverConnected ? 'Waiting for phone...' : 'Starting...'}
              </span>
            </div>
          </div>
        )}

        {/* State 2: connected, waiting for a movie */}
        {phoneOnline && !isTransferring && !hasVideo && (
          <div className="waiting-state animate-fade-in" style={{ padding: '60px 20px' }}>
            <div className="waiting-icon">🎬</div>
            <h2>Ready to Receive Movie</h2>
            <p>Select any video file on your phone to start streaming directly to this screen.</p>
          </div>
        )}

        {/* State 3: receiving */}
        {isTransferring && (
          <div className="waiting-state animate-fade-in">
            <ConnectionStatus state="transferring" />
            <h2>Receiving Movie</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              {incoming?.name || 'Incoming video...'}
            </p>
            <ProgressBar progress={progress} label="Receiving video over local network..." />
          </div>
        )}

        {/* State 4: player */}
        {hasVideo && !isTransferring && (
          <VideoPlayer
            videoUrl={video.url}
            videoMeta={videoMeta}
            onPlaybackStateChange={handlePlaybackStateChange}
            controlMessages={lastControl}
          />
        )}
      </div>
    </div>
  );
}
