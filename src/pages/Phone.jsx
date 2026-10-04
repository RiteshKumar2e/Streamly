import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import useWebRTC, { CONNECTION_STATES } from '../hooks/useWebRTC.js';
import useVideoTransfer from '../hooks/useVideoTransfer.js';
import FilePicker from '../components/FilePicker.jsx';
import RemoteControls from '../components/RemoteControls.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function Phone() {
  const [searchParams] = useSearchParams();
  const laptopSession = searchParams.get('session') || '';

  const {
    connectionState,
    setConnectionState,
    error,
    playbackState,
    joinLaptopSession,
    sendControl,
    onControlMessage,
    onTransferChannelReady,
    getTransferChannel,
    disconnect,
    clearError,
    handleError,
  } = useWebRTC('phone');

  const {
    selectedFile,
    transferProgress,
    isTransferring,
    isTransferComplete,
    transferError,
    handleFileSelect,
    startSending,
    cleanup: cleanupTransfer,
    setTransferError,
  } = useVideoTransfer();

  const [hasStartedWatching, setHasStartedWatching] = useState(false);
  // Auto-connect to laptop session from QR code
  useEffect(() => {
    if (!laptopSession) return;
    joinLaptopSession(laptopSession);
  }, [laptopSession, joinLaptopSession]);

  // Hook up incoming control messages from laptop
  useEffect(() => {
    onControlMessage((msg) => {
      if (msg.type === 'ready') {
        setConnectionState(CONNECTION_STATES.READY);
      } else if (msg.type === 'error') {
        handleError(msg.message || 'Error reported by laptop');
      }
    });
  }, [onControlMessage, setConnectionState, handleError]);

  // Handle start watching: send metadata and initiate transfer
  const handleStartWatching = () => {
    if (!selectedFile) return;
    const channel = getTransferChannel();
    if (!channel || channel.readyState !== 'open') {
      handleError('Connection to laptop is not open. Please wait or re-scan the QR code.');
      return;
    }

    setHasStartedWatching(true);
    setConnectionState(CONNECTION_STATES.TRANSFERRING);

    // Notify laptop of file metadata over control channel
    sendControl({
      type: 'file-info',
      name: selectedFile.name,
      size: selectedFile.size,
      mimeType: selectedFile.type,
    });

    // Start streaming chunked transfer
    startSending(channel);
  };

  // When transfer finishes
  useEffect(() => {
    if (isTransferComplete) {
      setConnectionState(CONNECTION_STATES.READY);
    }
  }, [isTransferComplete, setConnectionState]);

  // Remote control action handlers
  const handlePlay = () => sendControl({ type: 'play' });
  const handlePause = () => sendControl({ type: 'pause' });
  const handleSeek = (time) => sendControl({ type: 'seek', time });

  const handleSeekRelative = (seconds) => {
    const current = playbackState.currentTime || 0;
    const duration = playbackState.duration || 0;
    const nextTime = Math.max(0, Math.min(duration, current + seconds));
    sendControl({ type: 'seek', time: nextTime });
  };

  const handleVolumeChange = (value) => sendControl({ type: 'volume', value });
  const handleMuteToggle = () => sendControl({ type: 'mute', value: !playbackState.muted });

  const handleDisconnect = () => {
    cleanupTransfer();
    disconnect();
    setHasStartedWatching(false);
  };

  const isConnected = connectionState === CONNECTION_STATES.CONNECTED ||
                      connectionState === CONNECTION_STATES.READY ||
                      connectionState === CONNECTION_STATES.PLAYING ||
                      connectionState === CONNECTION_STATES.TRANSFERRING;

  return (
    <div className="mode-page" id="phone-page">
      <div className="mode-header">
        <h1>Streamly</h1>
        {!isConnected && (
          <p>Connect to the big screen.</p>
        )}
      </div>

      <div className="mode-content">
        {(error || transferError) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
            <ErrorMessage
              message={error || transferError}
              onDismiss={() => {
                clearError();
                setTransferError(null);
              }}
            />
            {laptopSession && !isConnected && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  clearError();
                  setTransferError(null);
                  pairingStartedRef.current = false;
                  joinLaptopSession(laptopSession);
                }}
                id="phone-retry-btn"
              >
                🔄 Retry Connection
              </button>
            )}
          </div>
        )}

        {/* State 1: Connecting (auto from QR scan) */}
        {!isConnected && (
          <div className="pairing-section animate-fade-in-up">
            <div className="waiting-text" style={{ padding: '40px 0', flexDirection: 'column', gap: 20 }}>
              <div className="waiting-spinner" style={{ width: 48, height: 48 }} />
              <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {laptopSession ? 'Connecting to laptop...' : 'Waiting for connection...'}
              </span>
              {!laptopSession && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 300, textAlign: 'center' }}>
                  Please scan the QR code displayed on your laptop screen to connect automatically.
                </p>
              )}
            </div>
          </div>
        )}

        {/* State 2: Connected, Movie Selection */}
        {isConnected && !hasStartedWatching && (
          <div className="pairing-section animate-fade-in-up">
            <div className="success-banner animate-fade-in" style={{ justifyContent: 'center', backgroundColor: 'var(--bg-card)', border: 'none', padding: '16px 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600 }}>
              <span className="success-icon" style={{ color: 'var(--success-color)' }}>✓</span>
              <span>Connected to your laptop</span>
            </div>

            <h2 style={{ fontSize: '1.4rem', marginBottom: 8, color: 'var(--text-primary)' }}>Choose a movie to watch</h2>

            <FilePicker
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
            />

            {selectedFile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ textAlign: 'center', color: 'var(--success-color)', fontWeight: 500 }}>
                  Ready to watch on laptop
                </p>
                <button
                  className="btn btn-primary btn-lg btn-block"
                  onClick={handleStartWatching}
                  id="start-watching-btn"
                >
                  ▶ Start Watching
                </button>
              </div>
            )}

            <button
              className="btn btn-ghost btn-sm"
              onClick={handleDisconnect}
              style={{ marginTop: 8 }}
            >
              Disconnect
            </button>
          </div>
        )}

        {/* State 3: Transferring video */}
        {isConnected && hasStartedWatching && isTransferring && (
          <div className="pairing-section animate-fade-in-up">
            <div style={{ textAlign: 'center', margin: '12px 0' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                Sending {selectedFile?.name}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Streaming to laptop over local WebRTC...
              </p>
            </div>

            <ProgressBar
              progress={transferProgress}
              label="Streaming video chunks"
            />
          </div>
        )}

        {/* State 4: Movie Ready / Playing — Remote Controls */}
        {isConnected && hasStartedWatching && !isTransferring && (
          <RemoteControls
            playbackState={playbackState}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onSeekRelative={handleSeekRelative}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            fileName={selectedFile?.name}
            onDisconnect={handleDisconnect}
          />
        )}
      </div>
    </div>
  );
}
