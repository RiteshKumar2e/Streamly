/**
 * Streamly — useWebRTC Hook (PeerJS unified connection)
 *
 * Uses PeerJS cloud signaling (0.peerjs.com) for 100% client-side WebRTC.
 * No custom backend or WebSocket server needed. Works directly on Vercel.
 *
 * Architecture:
 * - Laptop generates a session ID and displays it in a QR code.
 * - Phone scans the QR code and opens /phone?session=<id>.
 * - A single, high-performance DataConnection is established.
 * - Control messages (play, pause, seek, volume, state, file-info) are JSON.
 * - Video file transfer uses the underlying RTCDataChannel for raw binary chunks.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'peerjs';
import { sendControlMessage, parseControlMessage } from '../services/webrtc.js';

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

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

/**
 * Generate a unique session ID for PeerJS.
 */
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanedUpRef.current = true;
      cleanup();
    };
  }, []);

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

  const handleError = useCallback((message) => {
    if (cleanedUpRef.current) return;
    console.error('Streamly connection error:', message);
    setError(message);
    setConnectionState(CONNECTION_STATES.ERROR);
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

    // Process incoming control messages
    conn.on('data', (data) => {
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          if (msg && msg.type) {
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
        } catch {
          // Non-JSON string or chunk message handled by transfer listener
        }
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
   * Laptop: Create PeerJS peer and display session in QR code.
   */
  const startLaptopSession = useCallback(async () => {
    try {
      setConnectionState(CONNECTION_STATES.PAIRING);
      setError(null);

      const id = generateSessionId();
      setSessionId(id);

      const peer = new Peer(id, {
        debug: 1,
        config: {
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
        },
      });
      peerRef.current = peer;

      peer.on('open', (peerId) => {
        console.log('Laptop peer active:', peerId);
        setSessionId(peerId);
      });

      peer.on('connection', (conn) => {
        console.log('Incoming connection from phone');

        const onOpen = () => {
          setupConnection(conn);
          if (!cleanedUpRef.current) {
            setConnectionState(CONNECTION_STATES.CONNECTED);
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
          handleError('Connection issue: ' + (err.message || err.type));
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
  }, [setupConnection, handleError]);

  /**
   * Phone: Connect to laptop's PeerJS peer using session ID from QR code.
   */
  const joinLaptopSession = useCallback(async (laptopSessionId) => {
    if (!laptopSessionId) return;

    try {
      setConnectionState(CONNECTION_STATES.CONNECTING);
      setError(null);

      const phoneId = 'phone-' + generateSessionId();

      const peer = new Peer(phoneId, {
        debug: 1,
        config: {
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
        },
      });
      peerRef.current = peer;

      peer.on('open', () => {
        console.log('Phone peer active, connecting to laptop:', laptopSessionId);

        const conn = peer.connect(laptopSessionId, {
          label: 'streamly',
          reliable: true,
          serialization: 'none',
        });

        const onOpen = () => {
          console.log('Connected to laptop!');
          setupConnection(conn);
          if (!cleanedUpRef.current) {
            setConnectionState(CONNECTION_STATES.CONNECTED);
          }
        };

        if (conn.open) {
          onOpen();
        } else {
          conn.on('open', onOpen);
        }

        conn.on('error', (err) => {
          handleError('Failed to connect to laptop: ' + (err.message || 'Connection failed'));
        });
      });

      peer.on('error', (err) => {
        console.error('Phone PeerJS error:', err);
        if (err.type === 'peer-unavailable') {
          handleError('Laptop not found. Please make sure the laptop screen is open and re-scan the QR code.');
        } else {
          handleError('Connection error: ' + (err.message || err.type));
        }
      });

    } catch (err) {
      handleError('Failed to connect: ' + err.message);
    }
  }, [setupConnection, handleError]);

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
    cleanup();
    setConnectionState(CONNECTION_STATES.DISCONNECTED);
    setSessionId('');
  }, [cleanup]);

  /**
   * Reset to idle.
   */
  const reset = useCallback(() => {
    cleanup();
    setConnectionState(CONNECTION_STATES.IDLE);
    setError(null);
    setSessionId('');
  }, [cleanup]);

  return {
    // State
    connectionState,
    setConnectionState,
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
