import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import useWebRTC, { CONNECTION_STATES } from '../hooks/useWebRTC.js';
import useVideoTransfer from '../hooks/useVideoTransfer.js';
import usePairing from '../hooks/usePairing.js';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import PairingCode from '../components/PairingCode.jsx';
import QRCode from '../components/QRCode.jsx';

export default function Laptop() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const {
    connectionState,
    pairingCode,
    setConnectionState,
    error,
    encodedOffer: generatedAnswer,
    showSignalingModal,
    setShowSignalingModal,
    joinPairing,
    acceptManualOffer,
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

  const { inputCode, setInputCode, formatCodeInput, validateCode } = usePairing();

  const [lastControlMessage, setLastControlMessage] = useState(null);
  const [manualOfferInput, setManualOfferInput] = useState('');
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [incomingFileInfo, setIncomingFileInfo] = useState(null);
  const autoJoinRef = useRef(false);

  useEffect(() => {
    if (!pairingCode || autoJoinRef.current || initialCode) return;
    autoJoinRef.current = true;
    joinPairing(pairingCode);
  }, [initialCode, joinPairing, pairingCode]);

  // Auto-fill code from URL query param if present
  useEffect(() => {
    if (initialCode) {
      const formatted = formatCodeInput(initialCode);
      setInputCode(formatted);
      if (validateCode(formatted)) {
        joinPairing(formatted);
      }
    }
  }, [initialCode, formatCodeInput, setInputCode, validateCode, joinPairing]);

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

  // Handle manual code submission
  const handleConnect = (e) => {
    e?.preventDefault();
    if (!validateCode(inputCode)) {
      handleError('Please enter a valid 6-digit pairing code.');
      return;
    }
    joinPairing(inputCode);
  };

  const handleInputChange = (e) => {
    const formatted = formatCodeInput(e.target.value);
    setInputCode(formatted);
  };

  // Playback state reporting back to phone
  const handlePlaybackStateChange = (stateMsg) => {
    sendControl(stateMsg);
  };

  const handleManualOfferSubmit = () => {
    if (!manualOfferInput.trim()) return;
    acceptManualOffer(manualOfferInput);
  };

  const copyAnswerToClipboard = async () => {
    if (!generatedAnswer) return;
    try {
      await navigator.clipboard.writeText(generatedAnswer);
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2500);
    } catch {
      setCopiedAnswer(true);
    }
  };

  const isConnected = connectionState === CONNECTION_STATES.CONNECTED ||
                      connectionState === CONNECTION_STATES.READY ||
                      connectionState === CONNECTION_STATES.PLAYING ||
                      connectionState === CONNECTION_STATES.TRANSFERRING;

  const hasVideo = !!videoUrl;
  const rawPairingCode = pairingCode.replace(/\s/g, '');
  const phonePairingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/phone?code=${rawPairingCode}`
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
          <ErrorMessage
            message={error || transferError}
            onDismiss={() => {
              clearError();
              setTransferError(null);
            }}
          />
        )}

        {/* State 1: Enter Pairing Code */}
        {!isConnected && (
          <div className="pairing-section animate-fade-in-up">
            <QRCode value={phonePairingUrl} size={250} />
            
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                Scan with your phone camera
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                No PIN. No account. Just scan and connect.
              </p>
            </div>
            
            {/* Removed manual PIN entry form */}

            {connectionState === CONNECTION_STATES.CONNECTING && (
              <div style={{ marginTop: 20 }}>
                <ConnectionStatus state="connecting" />
              </div>
            )}
          </div>
        )}

        {/* State 2: Connected, waiting for movie (Empty State) */}
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

      {/* Manual WebRTC Signaling Modal */}
      {showSignalingModal && (
        <div className="modal-overlay" onClick={() => setShowSignalingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Serverless WebRTC Pairing</h2>
            <p>
              Direct browser-to-browser WebRTC connection without any backend servers.
            </p>

            <label htmlFor="laptop-offer-paste">Step 1: Paste Offer from Phone</label>
            <textarea
              id="laptop-offer-paste"
              placeholder="Paste the Offer string from Phone's Direct Signaling modal here..."
              value={manualOfferInput}
              onChange={(e) => setManualOfferInput(e.target.value)}
            />

            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={handleManualOfferSubmit}
              disabled={!manualOfferInput.trim()}
              id="generate-answer-btn"
            >
              Generate Answer
            </button>

            {generatedAnswer && (
              <div style={{ marginTop: 24 }}>
                <label htmlFor="laptop-answer-copy">Step 2: Copy Answer to Phone</label>
                <textarea
                  id="laptop-answer-copy"
                  readOnly
                  value={generatedAnswer}
                />
                <button
                  className={`copy-btn ${copiedAnswer ? 'copied' : ''}`}
                  onClick={copyAnswerToClipboard}
                  id="copy-answer-btn"
                >
                  {copiedAnswer ? '✓ Copied to Clipboard!' : '📋 Copy Answer'}
                </button>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Paste this string into Step 2 on your phone to complete the connection.
                </p>
              </div>
            )}

            <div className="modal-actions">
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
