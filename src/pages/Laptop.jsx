import React, { useState, useEffect, useRef } from 'react';
import useWebRTC, { CONNECTION_STATES } from '../hooks/useWebRTC.js';
import useVideoTransfer from '../hooks/useVideoTransfer.js';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import QRCode from '../components/QRCode.jsx';

export default function Laptop() {
  const {
    connectionState,
    sessionId,
    setConnectionState,
    error,
    startLaptopSession,
    sendControl,
    onControlMessage,
    onTransferChannelReady,
    disconnect,
    clearError,
    handleError,
  } = useWebRTC('laptop');

  const {
    transferProgress,
    isTransferring,
    isTransferComplete,
    videoUrl,
    videoMeta,
    transferError,
    startReceiving,
    cleanup: cleanupTransfer,
    setTransferError,
  } = useVideoTransfer();

  const [lastControlMessage, setLastControlMessage] = useState(null);
  const [incomingFileInfo, setIncomingFileInfo] = useState(null);
  // Start laptop PeerJS session on mount
  useEffect(() => {
    startLaptopSession();
  }, [startLaptopSession]);

  // Hook up incoming control messages from phone
  useEffect(() => {
    onControlMessage((msg) => {
      if (msg.type === 'file-info') {
        setIncomingFileInfo(msg);
      } else if (msg.type === 'play' || msg.type === 'pause' || msg.type === 'seek' || msg.type === 'volume' || msg.type === 'mute') {
        setLastControlMessage(msg);
      }
    });
  }, [onControlMessage]);

  // When transfer data channel is open, start listening for incoming video
  useEffect(() => {
    onTransferChannelReady((channel) => {
      startReceiving(channel);
    });
  }, [onTransferChannelReady, startReceiving]);

  // When file transfer completes, notify phone that laptop is ready
  useEffect(() => {
    if (isTransferComplete && videoUrl) {
      setConnectionState(CONNECTION_STATES.READY);
      sendControl({ type: 'ready' });
    }
  }, [isTransferComplete, videoUrl, setConnectionState, sendControl]);

  // Playback state reporting back to phone
  const handlePlaybackStateChange = (stateMsg) => {
    sendControl(stateMsg);
  };

  const isConnected = connectionState === CONNECTION_STATES.CONNECTED ||
                      connectionState === CONNECTION_STATES.READY ||
                      connectionState === CONNECTION_STATES.PLAYING ||
                      connectionState === CONNECTION_STATES.TRANSFERRING;

  const hasVideo = !!videoUrl;

  // QR code URL that phone will open
  const phonePairingUrl = typeof window !== 'undefined' && sessionId
    ? `${window.location.origin}/phone?session=${sessionId}`
    : '';

  return (
    <div className="mode-page" id="laptop-page">
      {!hasVideo && (
        <div className="mode-header">
          <h1>{isConnected ? '✓ Phone Connected' : 'Streamly'}</h1>
          <p style={isConnected ? {} : { fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 400, margin: '0 auto' }}>
            {isConnected
              ? 'Choose a movie on your phone.'
              : 'Connect your phone to watch on the big screen.'}
          </p>
        </div>
      )}

      <div className="mode-content" style={hasVideo ? { padding: 0, justifyContent: 'flex-start' } : {}}>
        {(error || transferError) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
            <ErrorMessage
              message={error || transferError}
              onDismiss={() => {
                clearError();
                setTransferError(null);
              }}
            />
            {!isConnected && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  clearError();
                  setTransferError(null);
                  startLaptopSession();
                }}
                id="laptop-retry-btn"
              >
                🔄 Regenerate QR Code
              </button>
            )}
          </div>
        )}

        {/* State 1: Show QR Code */}
        {!isConnected && (
          <div className="pairing-section animate-fade-in-up">
            {phonePairingUrl ? (
              <QRCode value={phonePairingUrl} size={250} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="waiting-spinner" style={{ width: 48, height: 48, margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Setting up session...</p>
              </div>
            )}
            
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                Scan with your phone camera
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                No PIN. No account. Just scan and connect.
              </p>
            </div>

            {connectionState === CONNECTION_STATES.CONNECTING && (
              <div style={{ marginTop: 20 }}>
                <ConnectionStatus state="connecting" />
              </div>
            )}

            <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div className="waiting-spinner" />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Waiting for phone...</span>
            </div>
          </div>
        )}

        {/* State 2: Connected, waiting for movie */}
        {isConnected && !isTransferring && !hasVideo && (
          <div className="waiting-state animate-fade-in" style={{ padding: '60px 20px' }}>
            <div className="waiting-icon">🎬</div>
            <h2>Ready to Receive Movie</h2>
            <p>
              {incomingFileInfo
                ? `Preparing to stream ${incomingFileInfo.name}...`
                : 'Select any video file on your phone to start streaming directly to this screen.'}
            </p>
          </div>
        )}

        {/* State 3: Receiving video chunks */}
        {isConnected && isTransferring && (
          <div className="waiting-state animate-fade-in">
            <ConnectionStatus state="transferring" />
            <h2>Receiving Movie Stream</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              {videoMeta?.name || incomingFileInfo?.name || 'Incoming video...'}
            </p>
            <ProgressBar
              progress={transferProgress}
              label="Receiving video chunks..."
            />
          </div>
        )}

        {/* State 4: Video Player */}
        {hasVideo && (
          <VideoPlayer
            videoUrl={videoUrl}
            videoMeta={videoMeta || incomingFileInfo}
            onPlaybackStateChange={handlePlaybackStateChange}
            controlMessages={lastControlMessage}
          />
        )}
      </div>
    </div>
  );
}
