/**
 * Streamly — useWebRTC Hook (Next.js Native WebRTC Engine)
 *
 * Direct Device-to-Device WebRTC with serverless HTTP signaling via /api/signal.
 * 100% Hosted on Vercel with zero external WebSocket or third-party dependencies.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

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

// Fast and reliable globally distributed STUN servers
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

  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const processedMessageIds = useRef(new Set());
  const pendingCandidates = useRef([]);
  const onControlMessageRef = useRef(null);
  const onTransferChannelReadyRef = useRef(null);
  const isCleanedUpRef = useRef(false);

  // Send signaling message via Next.js API route
  const sendSignal = useCallback(async (currentSessionId, role, message) => {
    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          role,
          message,
        }),
      });
      return res.ok;
    } catch (err) {
      console.error('Failed to send signal:', err);
      return false;
    }
  }, []);

  // Poll for signaling messages from the other peer
  const pollSignals = useCallback(async (currentSessionId, role, onMessage) => {
    if (isCleanedUpRef.current) return;

    try {
      const res = await fetch(`/api/signal?sessionId=${currentSessionId}&role=${role}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          for (const msg of data.messages) {
            if (msg.id && processedMessageIds.current.has(msg.id)) continue;
            if (msg.id) processedMessageIds.current.add(msg.id);
            await onMessage(msg);
          }
        }
      }
    } catch (err) {
      // transient network hiccup, polling will retry
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopPolling();
    if (channelRef.current) {
      try { channelRef.current.close(); } catch {}
      channelRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    processedMessageIds.current.clear();
    pendingCandidates.current = [];
  }, [stopPolling]);

  // Clean up on unmount
  useEffect(() => {
    isCleanedUpRef.current = false;
    return () => {
      isCleanedUpRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  const handleError = useCallback((msg) => {
    if (isCleanedUpRef.current) return;
    console.error('Streamly WebRTC Error:', msg);
    setError(msg);
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
   * Configure the established WebRTC DataChannel for control messages and file transfers.
   */
  const setupChannel = useCallback((channel) => {
    channelRef.current = channel;
    channel.binaryType = 'arraybuffer';
    try {
      channel.bufferedAmountLowThreshold = 256 * 1024;
    } catch {}

    channel.onopen = () => {
      console.log('WebRTC DataChannel OPENED!');
      stopPolling();
      if (!isCleanedUpRef.current) {
        setConnectionState(CONNECTION_STATES.CONNECTED);
        setConnectionStatusText('Connected!');
      }
      onTransferChannelReadyRef.current?.(channel);
    };

    channel.onclose = () => {
      console.log('WebRTC DataChannel closed');
      if (!isCleanedUpRef.current) {
        setConnectionState(CONNECTION_STATES.DISCONNECTED);
        setConnectionStatusText('Disconnected');
      }
    };

    channel.onerror = (err) => {
      console.warn('DataChannel error:', err);
    };

    channel.onmessage = (event) => {
      const { data } = event;
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          if (msg && msg.type) {
            if (['play', 'pause', 'seek', 'volume', 'mute', 'state', 'file-info', 'ready', 'error'].includes(msg.type)) {
              if (msg.type === 'state') {
                setPlaybackState((prev) => ({
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
    };
  }, [stopPolling]);

  /**
   * Laptop: Starts waiting for phone by listening for offer on /api/signal.
   */
  const startLaptopSession = useCallback(async () => {
    cleanup();
    isCleanedUpRef.current = false;

    try {
      const id = generateSessionId();
      setSessionId(id);
      setConnectionState(CONNECTION_STATES.PAIRING);
      setConnectionStatusText('Waiting for phone scan...');
      setError(null);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // When phone creates data channel, receive it on laptop
      pc.ondatachannel = (e) => {
        console.log('Laptop received data channel from phone');
        setupChannel(e.channel);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal(id, 'laptop', { type: 'ice', candidate: e.candidate.toJSON() });
        }
      };

      // Message handler for incoming signals from phone
      const handlePhoneSignal = async (msg) => {
        if (msg.type === 'offer') {
          console.log('Laptop received WebRTC offer from phone');
          setConnectionStatusText('Connecting to phone...');

          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));

          // Add any queued candidates
          while (pendingCandidates.current.length > 0) {
            const cand = pendingCandidates.current.shift();
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await sendSignal(id, 'laptop', { type: 'answer', sdp: answer.sdp });
        } else if (msg.type === 'ice' && msg.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
          } else {
            pendingCandidates.current.push(msg.candidate);
          }
        }
      };

      // Poll every 500ms
      pollingTimerRef.current = setInterval(() => {
        pollSignals(id, 'laptop', handlePhoneSignal);
      }, 500);

    } catch (err) {
      handleError('Failed to initialize session: ' + err.message);
    }
  }, [cleanup, setupChannel, sendSignal, pollSignals, handleError]);

  /**
   * Phone: Connects to laptop by sending offer through /api/signal.
   */
  const joinLaptopSession = useCallback(async (laptopSessionId) => {
    if (!laptopSessionId) return;

    cleanup();
    isCleanedUpRef.current = false;

    try {
      setConnectionState(CONNECTION_STATES.CONNECTING);
      setConnectionStatusText('Connecting to laptop...');
      setError(null);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // Phone creates the DataChannel
      const channel = pc.createDataChannel('streamly', { ordered: true });
      setupChannel(channel);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal(laptopSessionId, 'phone', { type: 'ice', candidate: e.candidate.toJSON() });
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal(laptopSessionId, 'phone', { type: 'offer', sdp: offer.sdp });
      console.log('Phone sent WebRTC offer to laptop');

      // Message handler for incoming signals from laptop
      const handleLaptopSignal = async (msg) => {
        if (msg.type === 'answer') {
          console.log('Phone received WebRTC answer from laptop');
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));

          // Add any queued candidates
          while (pendingCandidates.current.length > 0) {
            const cand = pendingCandidates.current.shift();
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
          }
        } else if (msg.type === 'ice' && msg.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
          } else {
            pendingCandidates.current.push(msg.candidate);
          }
        }
      };

      // Poll every 500ms for laptop answer and ICE candidates
      pollingTimerRef.current = setInterval(() => {
        pollSignals(laptopSessionId, 'phone', handleLaptopSignal);
      }, 500);

      // Safety timeout after 15 seconds
      setTimeout(() => {
        if (!channelRef.current || channelRef.current.readyState !== 'open') {
          if (connectionState === CONNECTION_STATES.CONNECTING) {
            setConnectionStatusText('Connection taking longer than expected. Tap Retry below.');
          }
        }
      }, 15000);

    } catch (err) {
      handleError('Failed to connect: ' + err.message);
    }
  }, [cleanup, setupChannel, sendSignal, pollSignals, handleError, connectionState]);

  /**
   * Send control message over DataChannel.
   */
  const sendControl = useCallback((message) => {
    const channel = channelRef.current;
    if (channel && channel.readyState === 'open') {
      try {
        channel.send(JSON.stringify(message));
        return true;
      } catch (err) {
        console.error('sendControl error:', err);
        return false;
      }
    }
    return false;
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
    const channel = channelRef.current;
    if (channel && channel.readyState === 'open') {
      handler(channel);
    }
  }, []);

  /**
   * Get the transfer channel.
   */
  const getTransferChannel = useCallback(() => {
    return channelRef.current;
  }, []);

  /**
   * Disconnect.
   */
  const disconnect = useCallback(() => {
    cleanup();
    setConnectionState(CONNECTION_STATES.DISCONNECTED);
    setConnectionStatusText('');
    setSessionId('');
  }, [cleanup]);

  /**
   * Reset to idle.
   */
  const reset = useCallback(() => {
    cleanup();
    setConnectionState(CONNECTION_STATES.IDLE);
    setConnectionStatusText('');
    setError(null);
    setSessionId('');
  }, [cleanup]);

  return {
    connectionState,
    setConnectionState,
    connectionStatusText,
    sessionId,
    pairingCode: sessionId,
    error,
    playbackState,
    setPlaybackState,

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

    CONNECTION_STATES,
  };
}

export { CONNECTION_STATES };
