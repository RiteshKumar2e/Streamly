import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import useWebRTC, { CONNECTION_STATES } from '../hooks/useWebRTC.js';
import useVideoTransfer from '../hooks/useVideoTransfer.js';
import PairingCode from '../components/PairingCode.jsx';
import FilePicker from '../components/FilePicker.jsx';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import RemoteControls from '../components/RemoteControls.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function Phone() {
  const [searchParams] = useSearchParams();
  const scannedCode = searchParams.get('code') || '';
  const {
    connectionState,
    setConnectionState,
    pairingCode,
    error,
    encodedOffer,
    showSignalingModal,
    setShowSignalingModal,
    playbackState,
    startPairing,
    acceptManualAnswer,
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

  const [manualAnswerInput, setManualAnswerInput] = useState('');
  const [copiedOffer, setCopiedOffer] = useState(false);
  const [hasStartedWatching, setHasStartedWatching] = useState(false);
  const pairingStartedRef = useRef(false);

  // Initialize pairing when entering phone mode
  useEffect(() => {
    if (pairingStartedRef.current) return;
    pairingStartedRef.current = true;
    startPairing(scannedCode);
  }, [scannedCode, startPairing]);

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
      handleError('Connection to laptop is not open. Please wait or re-pair.');
      return;
    }

    setHasStartedWatching(true);
    setConnectionState(CONNECTION_STATES.TRANSFERRING);

    // Notify laptop of file metadata over control channel as well
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
  const handlePlay = () => {
    sendControl({ type: 'play' });
  };

  const handlePause = () => {
    sendControl({ type: 'pause' });
  };

  const handleSeek = (time) => {
    sendControl({ type: 'seek', time });
  };

  const handleSeekRelative = (seconds) => {
    const current = playbackState.currentTime || 0;
    const duration = playbackState.duration || 0;
    const nextTime = Math.max(0, Math.min(duration, current + seconds));
    sendControl({ type: 'seek', time: nextTime });
  };

  const handleVolumeChange = (value) => {
    sendControl({ type: 'volume', value });
  };

  const handleMuteToggle = () => {
    sendControl({ type: 'mute', value: !playbackState.muted });
  };

  const handleDisconnect = () => {
    cleanupTransfer();
    disconnect();
    setHasStartedWatching(false);
  };

  const copyOfferToClipboard = async () => {
    if (!encodedOffer) return;
    try {
      await navigator.clipboard.writeText(encodedOffer);
      setCopiedOffer(true);
      setTimeout(() => setCopiedOffer(false), 2500);
    } catch {
      // Fallback
      setCopiedOffer(true);
    }
  };

  const submitManualAnswer = () => {
    if (!manualAnswerInput.trim()) return;
    acceptManualAnswer(manualAnswerInput);
  };

  // Generate QR pairing link
  const isConnected = connectionState === CONNECTION_STATES.CONNECTED ||
                      connectionState === CONNECTION_STATES.READY ||
                      connectionState === CONNECTION_STATES.PLAYING ||
                      connectionState === CONNECTION_STATES.TRANSFERRING;

  return (
    <div className="mode-page" id="phone-page">
      <div className="mode-header">
        <div className="mode-badge">
          <span className="mode-badge-icon">📱</span>
          <span>Phone Mode</span>
        </div>
        <h1>{isConnected ? 'Laptop Connected' : 'Connect to Big Screen'}</h1>
        <p>
          {isConnected
            ? 'Your phone is paired and acting as the remote.'
            : 'Point your laptop browser to Streamly to pair.'}
        </p>
      </div>

      <div className="mode-content">
        {(error || transferError) && (
          <ErrorMessage
            message={error || transferError}
            onDismiss={() => {
              clearError();
              setTransferError(null);
            }}
          />
        )}

        {/* State 1: Pairing (Not yet connected) */}
        {!isConnected && (
          <div className="pairing-section animate-fade-in-up">
            <PairingCode code={pairingCode || '------'} label="Pairing Code" />

            <div className="waiting-text">
              <div className="waiting-spinner" />
              <span>Waiting for laptop...</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSignalingModal(true)}
                id="phone-manual-signal-btn"
              >
                ⚙️ Direct Signaling (Cross-Device)
              </button>
            </div>
          </div>
        )}

        {/* State 2: Connected, Movie Selection */}
        {isConnected && !hasStartedWatching && (
          <div className="pairing-section animate-fade-in-up">
            <div className="success-banner animate-fade-in">
              <span className="success-icon">✓</span>
              <span>Laptop paired successfully!</span>
            </div>

            <ConnectionStatus state="connected" />

            <FilePicker
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
            />

            {selectedFile && (
              <button
                className="btn btn-primary btn-lg btn-block"
                onClick={handleStartWatching}
                id="start-watching-btn"
              >
                ▶ Start Watching
              </button>
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
            <ConnectionStatus state="transferring" />
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

      {/* Manual Signaling Modal for true cross-browser / cross-device WebRTC */}
      {showSignalingModal && (
        <div className="modal-overlay" onClick={() => setShowSignalingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Serverless WebRTC Pairing</h2>
            <p>
              Streamly operates strictly client-side without any server backend.
              To pair across different devices on your Wi-Fi:
            </p>

            <label htmlFor="phone-offer-copy">Step 1: Copy Phone's Offer to Laptop</label>
            <textarea
              id="phone-offer-copy"
              readOnly
              value={encodedOffer || 'Generating offer...'}
            />
            <button
              className={`copy-btn ${copiedOffer ? 'copied' : ''}`}
              onClick={copyOfferToClipboard}
              id="copy-offer-btn"
            >
              {copiedOffer ? '✓ Copied to Clipboard!' : '📋 Copy Offer'}
            </button>

            <div style={{ marginTop: 20 }}>
              <label htmlFor="phone-answer-paste">Step 2: Paste Laptop's Answer Here</label>
              <textarea
                id="phone-answer-paste"
                placeholder="Paste the answer string generated on your laptop here..."
                value={manualAnswerInput}
                onChange={(e) => setManualAnswerInput(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={submitManualAnswer}
                disabled={!manualAnswerInput.trim()}
                id="connect-manual-answer-btn"
              >
                Complete Connection
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSignalingModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
