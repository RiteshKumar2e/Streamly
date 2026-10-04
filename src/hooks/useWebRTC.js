/**
 * Streamly — useWebRTC Hook
 *
 * Manages WebRTC peer connection lifecycle for both phone and laptop modes.
 * Handles connection state, data channels, and control messages.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createOffer,
  createAnswer,
  acceptAnswer,
  setupConnectionListeners,
  cleanupConnection,
  sendControlMessage,
  parseControlMessage,
} from '../services/webrtc.js';
import {
  BroadcastSignaling,
  generatePairingCode,
  normalizePairingCode,
  encodeSDP,
  decodeSDP,
} from '../services/signaling.js';

const CONNECTION_STATES = {
  IDLE: 'idle',
  PAIRING: 'pairing',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  TRANSFERRING: 'transferring',
  READY: 'ready',
  PLAYING: 'playing',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

export default function useWebRTC(mode) {
  const [connectionState, setConnectionState] = useState(CONNECTION_STATES.IDLE);
  const [pairingCode, setPairingCode] = useState('');
  const [error, setError] = useState(null);
  const [encodedOffer, setEncodedOffer] = useState('');
  const [showSignalingModal, setShowSignalingModal] = useState(false);
  const [signalingStep, setSignalingStep] = useState('');
  const [playbackState, setPlaybackState] = useState({
    currentTime: 0,
    duration: 0,
    paused: true,
    volume: 1,
    muted: false,
  });

  const pcRef = useRef(null);
  const controlChannelRef = useRef(null);
  const transferChannelRef = useRef(null);
  const signalingRef = useRef(null);
  const onControlMessageRef = useRef(null);
  const onTransferChannelReadyRef = useRef(null);

  // Generate pairing code for phone mode
  useEffect(() => {
    if (mode === 'phone') {
      setPairingCode(generatePairingCode());
    }
  }, [mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (signalingRef.current) {
      signalingRef.current.disconnect();
      signalingRef.current = null;
    }
    cleanupConnection(pcRef.current, [
      controlChannelRef.current,
      transferChannelRef.current,
    ]);
    pcRef.current = null;
    controlChannelRef.current = null;
    transferChannelRef.current = null;
  }, []);

  const handleError = useCallback((message) => {
    setError(message);
    setConnectionState(CONNECTION_STATES.ERROR);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (connectionState === CONNECTION_STATES.ERROR) {
      setConnectionState(CONNECTION_STATES.IDLE);
    }
  }, [connectionState]);

  // Set up control channel message handling
  const setupControlChannel = useCallback((channel) => {
    controlChannelRef.current = channel;

    channel.onmessage = (event) => {
      const msg = parseControlMessage(event.data);
      if (msg) {
        if (msg.type === 'state') {
          setPlaybackState(prev => ({
            ...prev,
            currentTime: msg.currentTime ?? prev.currentTime,
            duration: msg.duration ?? prev.duration,
            paused: msg.paused ?? prev.paused,
            volume: msg.volume ?? prev.volume,
            muted: msg.muted ?? prev.muted,
          }));
        }
        onControlMessageRef.current?.(msg);
      }
    };

    channel.onerror = () => {
      handleError('Control channel error');
    };
  }, [handleError]);

  // Set up transfer channel
  const setupTransferChannel = useCallback((channel) => {
    transferChannelRef.current = channel;
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = 256 * 1024;

    channel.onopen = () => {
      onTransferChannelReadyRef.current?.(channel);
    };

    channel.onerror = () => {
      handleError('Transfer channel error');
    };
  }, [handleError]);

  /**
   * Phone: Initiate pairing.
   * Tries BroadcastChannel first (for same-browser testing),
   * then falls back to manual SDP exchange.
   */
  const startPairing = useCallback(async () => {
    try {
      setConnectionState(CONNECTION_STATES.PAIRING);
      setError(null);

      const code = pairingCode || generatePairingCode();
      if (!pairingCode) setPairingCode(code);
      const normalizedCode = normalizePairingCode(code);

      // Create WebRTC offer
      const { pc, controlChannel, transferChannel, offer } = await createOffer();
      pcRef.current = pc;

      // Set up channels
      setupControlChannel(controlChannel);
      setupTransferChannel(transferChannel);

      // Monitor connection state
      setupConnectionListeners(pc, {
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setConnectionState(CONNECTION_STATES.CONNECTED);
          } else if (state === 'disconnected' || state === 'failed') {
            setConnectionState(CONNECTION_STATES.DISCONNECTED);
          }
        },
      });

      // Try BroadcastChannel signaling
      const signaling = new BroadcastSignaling(normalizedCode);
      const bcSupported = signaling.connect();
      signalingRef.current = signaling;

      if (bcSupported) {
        // Send offer via BroadcastChannel
        signaling.send('offer', encodeSDP(offer));

        // Listen for answer
        signaling.on('answer', async (encodedAnswer) => {
          try {
            const parsed = decodeSDP(encodedAnswer);
            if (parsed) {
              setConnectionState(CONNECTION_STATES.CONNECTING);
              await acceptAnswer(pc, parsed.sdp);
            }
          } catch (err) {
            handleError('Failed to process answer: ' + err.message);
          }
        });
      }

      // Also prepare manual signaling
      setEncodedOffer(encodeSDP(offer));

    } catch (err) {
      handleError('Failed to create connection: ' + err.message);
    }
  }, [pairingCode, setupControlChannel, setupTransferChannel, handleError]);

  /**
   * Laptop: Join a pairing session.
   */
  const joinPairing = useCallback(async (inputCode) => {
    try {
      setConnectionState(CONNECTION_STATES.PAIRING);
      setError(null);

      const normalizedCode = normalizePairingCode(inputCode);

      // Try BroadcastChannel first
      const signaling = new BroadcastSignaling(normalizedCode);
      const bcSupported = signaling.connect();
      signalingRef.current = signaling;

      if (bcSupported) {
        // Listen for offer
        signaling.on('offer', async (encodedOfferData) => {
          try {
            const parsed = decodeSDP(encodedOfferData);
            if (parsed) {
              setConnectionState(CONNECTION_STATES.CONNECTING);

              const { pc, answer } = await createAnswer(parsed.sdp);
              pcRef.current = pc;

              // Set up data channel listeners (laptop receives channels)
              pc.ondatachannel = (event) => {
                const ch = event.channel;
                if (ch.label === 'control') {
                  setupControlChannel(ch);
                } else if (ch.label === 'transfer') {
                  setupTransferChannel(ch);
                }
              };

              setupConnectionListeners(pc, {
                onConnectionStateChange: (state) => {
                  if (state === 'connected') {
                    setConnectionState(CONNECTION_STATES.CONNECTED);
                  } else if (state === 'disconnected' || state === 'failed') {
                    setConnectionState(CONNECTION_STATES.DISCONNECTED);
                  }
                },
              });

              // Send answer back
              signaling.send('answer', encodeSDP(answer));
            }
          } catch (err) {
            handleError('Failed to process offer: ' + err.message);
          }
        });

        // Wait a bit, then check if we got an offer
        // If phone opened first, the offer should come through BC
        // If not, we'll need manual signaling
        setTimeout(() => {
          if (connectionState === CONNECTION_STATES.PAIRING) {
            // No offer received via BC — show manual signaling
            setShowSignalingModal(true);
            setSignalingStep('paste-offer');
          }
        }, 3000);
      } else {
        // No BC support — go straight to manual
        setShowSignalingModal(true);
        setSignalingStep('paste-offer');
      }
    } catch (err) {
      handleError('Failed to join session: ' + err.message);
    }
  }, [connectionState, setupControlChannel, setupTransferChannel, handleError]);

  /**
   * Laptop: Accept a manually pasted offer.
   */
  const acceptManualOffer = useCallback(async (encodedOfferStr) => {
    try {
      const parsed = decodeSDP(encodedOfferStr.trim());
      if (!parsed) {
        handleError('Invalid connection data. Please check and try again.');
        return;
      }

      setConnectionState(CONNECTION_STATES.CONNECTING);

      const { pc, answer } = await createAnswer(parsed.sdp);
      pcRef.current = pc;

      pc.ondatachannel = (event) => {
        const ch = event.channel;
        if (ch.label === 'control') {
          setupControlChannel(ch);
        } else if (ch.label === 'transfer') {
          setupTransferChannel(ch);
        }
      };

      setupConnectionListeners(pc, {
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setConnectionState(CONNECTION_STATES.CONNECTED);
            setShowSignalingModal(false);
          } else if (state === 'disconnected' || state === 'failed') {
            setConnectionState(CONNECTION_STATES.DISCONNECTED);
          }
        },
      });

      setEncodedOffer(encodeSDP(answer));
      setSignalingStep('show-answer');
    } catch (err) {
      handleError('Failed to process offer: ' + err.message);
    }
  }, [setupControlChannel, setupTransferChannel, handleError]);

  /**
   * Phone: Accept a manually pasted answer.
   */
  const acceptManualAnswer = useCallback(async (encodedAnswerStr) => {
    try {
      const parsed = decodeSDP(encodedAnswerStr.trim());
      if (!parsed) {
        handleError('Invalid connection data. Please check and try again.');
        return;
      }

      setConnectionState(CONNECTION_STATES.CONNECTING);
      await acceptAnswer(pcRef.current, parsed.sdp);
      setShowSignalingModal(false);
    } catch (err) {
      handleError('Failed to process answer: ' + err.message);
    }
  }, [handleError]);

  /**
   * Send a control message.
   */
  const sendControl = useCallback((message) => {
    return sendControlMessage(controlChannelRef.current, message);
  }, []);

  /**
   * Set control message handler.
   */
  const onControlMessage = useCallback((handler) => {
    onControlMessageRef.current = handler;
  }, []);

  /**
   * Set transfer channel ready handler.
   */
  const onTransferChannelReady = useCallback((handler) => {
    onTransferChannelReadyRef.current = handler;
  }, []);

  /**
   * Get the transfer channel reference.
   */
  const getTransferChannel = useCallback(() => {
    return transferChannelRef.current;
  }, []);

  /**
   * Disconnect and clean up.
   */
  const disconnect = useCallback(() => {
    cleanup();
    setConnectionState(CONNECTION_STATES.DISCONNECTED);
    setPairingCode('');
    setEncodedOffer('');
    setShowSignalingModal(false);
  }, [cleanup]);

  /**
   * Reset to idle state.
   */
  const reset = useCallback(() => {
    cleanup();
    setConnectionState(CONNECTION_STATES.IDLE);
    setError(null);
    setPairingCode(mode === 'phone' ? generatePairingCode() : '');
    setEncodedOffer('');
    setShowSignalingModal(false);
    setSignalingStep('');
  }, [cleanup, mode]);

  return {
    // State
    connectionState,
    setConnectionState,
    pairingCode,
    error,
    encodedOffer,
    showSignalingModal,
    setShowSignalingModal,
    signalingStep,
    setSignalingStep,
    playbackState,
    setPlaybackState,

    // Actions
    startPairing,
    joinPairing,
    acceptManualOffer,
    acceptManualAnswer,
    sendControl,
    onControlMessage,
    onTransferChannelReady,
    getTransferChannel,
    disconnect,
    reset,
    clearError,
    handleError,

    // Constants
    CONNECTION_STATES,
  };
}

export { CONNECTION_STATES };
