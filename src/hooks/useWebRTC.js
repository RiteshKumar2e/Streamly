/**
 * Streamly — useWebRTC Hook (PeerJS unified connection)
 *
 * Uses PeerJS cloud signaling (0.peerjs.com) for 100% client-side WebRTC.
 * No custom backend or WebSocket server needed. Works directly on Vercel.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'peerjs';

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

// Fast and reliable Google STUN servers
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

function generateSessionId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = 'stream-';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default function useWebRTC(mode) {
  const [connectionState, setConnectionState] = useState(CONNECTION_STATES.IDLE);
  const [sessionId, setSessionId] = useState('');
  const [connectionStatusText, setConnectionStatusText] = useState('');
  const [error, setError] = useState(null);
  const [playbackState, setPlaybackState] = useState({
    currentTime: 0,
    duration: 0,
    paused: true,
    volume: 1,
    muted: false,
  });

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const onControlMessageRef = useRef(null);
  const onTransferChannelReadyRef = useRef(null);
  const cleanedUpRef = useRef(false);
  const cleanupTimeoutRef = useRef(null);

  const cleanup = useCallback(() => {
    if (connRef.current) {
      try { connRef.current.close(); } catch {}
      connRef.current = null;
    }
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }
  }, []);

  const cancelPendingCleanup = useCallback(() => {
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount (delayed to survive React 18 StrictMode)
  useEffect(() => {
    cancelPendingCleanup();
    return () => {
      cleanupTimeoutRef.current = setTimeout(() => {
        cleanedUpRef.current = true;
        cleanup();
      }, 300);
    };
  }, [cancelPendingCleanup, cleanup]);

  const handleError = useCallback((message) => {
    if (cleanedUpRef.current) return;
    console.error('Streamly connection error:', message);
    setError(message);
    setConnectionState(CONNECTION_STATES.ERROR);
    setConnectionStatusText('');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (connectionState === CONNECTION_STATES.ERROR) {
      setConnectionState(CONNECTION_STATES.IDLE);
    }
  }, [connectionState]);

  /**
   * Set up incoming or outgoing PeerJS data connection.
   */
  const setupConnection = useCallback((conn) => {
    connRef.current = conn;

    // Access underlying RTCDataChannel for high-speed binary transfer
    const rawDc = conn.dataChannel || conn._dc;
    if (rawDc) {
      rawDc.binaryType = 'arraybuffer';
      try {
        rawDc.bufferedAmountLowThreshold = 256 * 1024;
      } catch {}
    }

    // Process incoming messages
    conn.on('data', (data) => {
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          if (msg && msg.type) {
            // Handshake
            if (msg.type === 'handshake-ping') {
              conn.send(JSON.stringify({ type: 'handshake-pong' }));
              setConnectionState(CONNECTION_STATES.CONNECTED);
              return;
            }
            if (msg.type === 'handshake-pong') {
              setConnectionState(CONNECTION_STATES.CONNECTED);
              return;
            }

            // Remote control & playback
            if (['play', 'pause', 'seek', 'volume', 'mute', 'state', 'file-info', 'ready', 'error'].includes(msg.type)) {
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
          }
        } catch {}
      }
    });

    conn.on('close', () => {
      if (!cleanedUpRef.current) {
        setConnectionState(CONNECTION_STATES.DISCONNECTED);
      }
    });

    conn.on('error', (err) => {
      console.warn('Data connection error:', err);
    });

    // Provide transfer channel to video transfer handler
    const transferChannel = rawDc || conn;
    onTransferChannelReadyRef.current?.(transferChannel);
  }, []);

  /**
   * Laptop: Create PeerJS peer and display session in QR code once active.
   */
  const startLaptopSession = useCallback(async () => {
    cancelPendingCleanup();
    cleanedUpRef.current = false;

    // If active peer already registered, keep it
    if (peerRef.current && !peerRef.current.destroyed && !peerRef.current.disconnected && sessionId) {
      return;
    }

    try {
      setConnectionState(CONNECTION_STATES.PAIRING);
      setConnectionStatusText('Initializing session...');
      setError(null);

      const id = generateSessionId();

      const peer = new Peer(id, {
        debug: 1,
        config: {
          iceServers: ICE_SERVERS,
        },
      });
      peerRef.current = peer;

      peer.on('open', (peerId) => {
        console.log('Laptop peer registered on cloud:', peerId);
        // Only set session ID once peer is confirmed online by server
        setSessionId(peerId);
        setConnectionStatusText('Ready for phone connection');
      });

      peer.on('connection', (conn) => {
        console.log('Incoming connection from phone detected');
        setConnectionStatusText('Connecting to phone...');

        const onOpen = () => {
          console.log('Laptop connection opened!');
          setupConnection(conn);
          // Send handshake
          try {
            conn.send(JSON.stringify({ type: 'handshake-ping' }));
          } catch {}
          if (!cleanedUpRef.current) {
            setConnectionState(CONNECTION_STATES.CONNECTED);
            setConnectionStatusText('Phone connected!');
          }
        };

        if (conn.open) {
          onOpen();
        } else {
          conn.on('open', onOpen);
        }
      });

      peer.on('error', (err) => {
        console.error('Laptop PeerJS error:', err);
        if (err.type === 'unavailable-id') {
          peer.destroy();
          startLaptopSession();
        } else {
          handleError('Signaling error: ' + (err.message || err.type));
        }
      });

      peer.on('disconnected', () => {
        if (!cleanedUpRef.current && peer && !peer.destroyed) {
          try { peer.reconnect(); } catch {}
        }
      });

    } catch (err) {
      handleError('Failed to start session: ' + err.message);
    }
  }, [cancelPendingCleanup, setupConnection, handleError, sessionId]);

  /**
   * Phone: Connect to laptop's PeerJS peer using session ID from QR code.
   */
  const joinLaptopSession = useCallback(async (laptopSessionId) => {
    if (!laptopSessionId) return;

    cancelPendingCleanup();
    cleanedUpRef.current = false;

    // Clean up previous peer if any
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }

    try {
      setConnectionState(CONNECTION_STATES.CONNECTING);
      setConnectionStatusText('Connecting to pairing cloud...');
      setError(null);

      const phoneId = 'phone-' + generateSessionId();

      const peer = new Peer(phoneId, {
        debug: 1,
        config: {
          iceServers: ICE_SERVERS,
        },
      });
      peerRef.current = peer;

      peer.on('open', () => {
        console.log('Phone registered on cloud, connecting to laptop:', laptopSessionId);
        setConnectionStatusText('Connecting to laptop...');

        const conn = peer.connect(laptopSessionId, {
          label: 'streamly',
          reliable: true,
          serialization: 'none',
        });

        const onOpen = () => {
          console.log('Phone connection opened!');
          setupConnection(conn);
          // Send handshake ping
          try {
            conn.send(JSON.stringify({ type: 'handshake-ping' }));
          } catch {}
          if (!cleanedUpRef.current) {
            setConnectionState(CONNECTION_STATES.CONNECTED);
            setConnectionStatusText('Connected to laptop!');
          }
        };

        if (conn.open) {
          onOpen();
        } else {
          conn.on('open', onOpen);
        }

        conn.on('error', (err) => {
          handleError('Connection failed: ' + (err.message || 'Unable to connect to laptop'));
        });

        // 12-second safety timeout
        setTimeout(() => {
          if (!conn.open && connectionState === CONNECTION_STATES.CONNECTING) {
            setConnectionStatusText('Taking longer than usual. Please check your Wi-Fi or tap Retry.');
          }
        }, 12000);
      });

      peer.on('error', (err) => {
        console.error('Phone PeerJS error:', err);
        if (err.type === 'peer-unavailable') {
          handleError('Laptop not found. Please make sure the laptop screen is open and re-scan the QR code.');
        } else {
          handleError('Connection issue: ' + (err.message || err.type));
        }
      });

    } catch (err) {
      handleError('Failed to connect: ' + err.message);
    }
  }, [cancelPendingCleanup, setupConnection, handleError, connectionState]);

  /**
   * Send control message (JSON).
   */
  const sendControl = useCallback((message) => {
    const conn = connRef.current;
    if (!conn) return false;

    try {
      const payload = JSON.stringify(message);
      const rawDc = conn.dataChannel || conn._dc;
      if (rawDc && rawDc.readyState === 'open') {
        rawDc.send(payload);
        return true;
      } else if (conn.open) {
        conn.send(payload);
        return true;
      }
      return false;
    } catch (err) {
      console.error('sendControl error:', err);
      return false;
    }
  }, []);

  /**
   * Set control message listener.
   */
  const onControlMessage = useCallback((handler) => {
    onControlMessageRef.current = handler;
  }, []);

  /**
   * Set transfer channel ready listener.
   */
  const onTransferChannelReady = useCallback((handler) => {
    onTransferChannelReadyRef.current = handler;
    const conn = connRef.current;
    if (conn) {
      const rawDc = conn.dataChannel || conn._dc;
      if (rawDc && rawDc.readyState === 'open') {
        handler(rawDc);
      } else if (conn.open) {
        handler(conn);
      }
    }
  }, []);

  /**
   * Get the transfer channel reference.
   */
  const getTransferChannel = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return null;
    const rawDc = conn.dataChannel || conn._dc;
    return rawDc || conn;
  }, []);

  /**
   * Disconnect.
   */
  const disconnect = useCallback(() => {
    cancelPendingCleanup();
    cleanedUpRef.current = true;
    cleanup();
    setConnectionState(CONNECTION_STATES.DISCONNECTED);
    setConnectionStatusText('');
    setSessionId('');
  }, [cancelPendingCleanup, cleanup]);

  /**
   * Reset to idle.
   */
  const reset = useCallback(() => {
    cancelPendingCleanup();
    cleanedUpRef.current = true;
    cleanup();
    setConnectionState(CONNECTION_STATES.IDLE);
    setConnectionStatusText('');
    setError(null);
    setSessionId('');
  }, [cancelPendingCleanup, cleanup]);

  return {
    // State
    connectionState,
    setConnectionState,
    connectionStatusText,
    sessionId,
    pairingCode: sessionId,
    error,
    playbackState,
    setPlaybackState,

    // Actions
    startLaptopSession,
    joinLaptopSession,
    startPairing: joinLaptopSession,
    joinPairing: joinLaptopSession,
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
