/**
 * Streamly — useWebRTC Hook
 *
 * Direct device-to-device WebRTC. Signaling (offer/answer/ICE) goes through
 * src/services/relay.js; the video itself only ever travels over the DataChannel.
 *
 * Every phone connection attempt gets its own attemptId. The phone tags its
 * messages with `from: attemptId` and the laptop tags replies with `to: attemptId`,
 * so retries / page refreshes never mix up offers and answers from different attempts.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createSignalChannel } from '../services/relay.js';

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

const CONNECT_TIMEOUT_MS = 30000;
const OFFER_RESEND_MS = [5000, 12000, 20000];

const NETWORK_HINT = 'Make sure your phone and laptop are on the same Wi-Fi network (not guest Wi-Fi or mobile data), then tap Retry.';

function getIceServers() {
  const servers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  // Optional TURN relay — needed when the devices are on different networks / strict NATs
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(',').map((u) => u.trim()).filter(Boolean),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
    });
  }
  return servers;
}

// ICE candidates come in bursts; batch them so each side makes ~2-3 relay
// requests instead of one per candidate (ntfy.sh rate-limits per IP)
function createIceBatcher(sendBatch, delayMs = 400) {
  let queue = [];
  let timer = null;
  return (candidate) => {
    queue.push(candidate);
    if (timer) return;
    timer = setTimeout(() => {
      const batch = queue;
      queue = [];
      timer = null;
      sendBatch(batch);
    }, delayMs);
  };
}

function candidatesOf(msg) {
  if (Array.isArray(msg.candidates)) return msg.candidates;
  return msg.candidate ? [msg.candidate] : [];
}

function randomId(prefix, length) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = prefix;
  for (let i = 0; i < length; i++) {
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
  const signalRef = useRef(null);
  const attemptRef = useRef(null);
  const pendingCandidates = useRef([]);
  const timersRef = useRef([]);
  const onControlMessageRef = useRef(null);
  const onTransferChannelReadyRef = useRef(null);
  const isCleanedUpRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const addTimer = useCallback((fn, ms) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  // Close the peer connection + channel, but keep signaling open
  const closePeer = useCallback(() => {
    clearTimers();
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) {
      try { channel.close(); } catch {}
    }
    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      try { pc.close(); } catch {}
    }
    pendingCandidates.current = [];
  }, [clearTimers]);

  const cleanup = useCallback(() => {
    closePeer();
    if (signalRef.current) {
      signalRef.current.close();
      signalRef.current = null;
    }
    attemptRef.current = null;
  }, [closePeer]);

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
    setConnectionState((prev) => (prev === CONNECTION_STATES.ERROR ? CONNECTION_STATES.IDLE : prev));
  }, []);

  /**
   * Configure the WebRTC DataChannel used for control messages and file transfer.
   */
  const setupChannel = useCallback((channel, onOpened) => {
    channelRef.current = channel;
    channel.binaryType = 'arraybuffer';
    try {
      channel.bufferedAmountLowThreshold = 256 * 1024;
    } catch {}

    channel.onopen = () => {
      if (channelRef.current !== channel || isCleanedUpRef.current) return;
      console.log('WebRTC DataChannel open');
      clearTimers();
      setError(null);
      setConnectionState(CONNECTION_STATES.CONNECTED);
      setConnectionStatusText('Connected!');
      onOpened?.();
      onTransferChannelReadyRef.current?.(channel);
    };

    channel.onclose = () => {
      // Ignore channels we replaced or closed ourselves
      if (channelRef.current !== channel || isCleanedUpRef.current) return;
      console.log('WebRTC DataChannel closed');
      channelRef.current = null;
      if (mode === 'laptop') {
        // Laptop keeps listening, so the phone can simply re-scan / refresh to reconnect
        setConnectionState(CONNECTION_STATES.PAIRING);
        setConnectionStatusText('Phone disconnected. Scan the QR code again to reconnect.');
      } else {
        setConnectionState(CONNECTION_STATES.DISCONNECTED);
        setConnectionStatusText('Disconnected from laptop');
      }
    };

    channel.onerror = (err) => {
      console.warn('DataChannel error:', err);
    };

    channel.onmessage = (event) => {
      const { data } = event;
      if (typeof data !== 'string') return;
      try {
        const msg = JSON.parse(data);
        if (msg && ['play', 'pause', 'seek', 'volume', 'mute', 'state', 'file-info', 'ready', 'error'].includes(msg.type)) {
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
      } catch {}
    };
  }, [mode, clearTimers]);

  const flushCandidates = useCallback(async (pc, attemptId) => {
    const queued = pendingCandidates.current.filter((c) => c.attemptId === attemptId);
    pendingCandidates.current = pendingCandidates.current.filter((c) => c.attemptId !== attemptId);
    for (const { candidate } of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  }, []);

  /**
   * Laptop: generate a session (shown as QR code) and answer whichever phone offers.
   */
  const startLaptopSession = useCallback(async () => {
    cleanup();
    isCleanedUpRef.current = false;

    const id = randomId('stream-', 10);
    setSessionId(id);
    setConnectionState(CONNECTION_STATES.PAIRING);
    setConnectionStatusText('Waiting for phone scan...');
    setError(null);

    // Last answer per attempt, so a re-sent offer gets the same answer back
    const answers = new Map();

    const answerOffer = async (msg, signal) => {
      const attemptId = msg.from;

      // Duplicate offer for the attempt we're already handling: re-send our answer
      if (attemptRef.current === attemptId && pcRef.current) {
        const prev = answers.get(attemptId);
        if (prev) signal.send({ type: 'answer', to: attemptId, sdp: prev });
        return;
      }

      // New phone / new attempt: replace any previous connection
      closePeer();
      attemptRef.current = attemptId;
      setConnectionState(CONNECTION_STATES.PAIRING);
      setConnectionStatusText('Phone found — connecting...');

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcRef.current = pc;

      pc.ondatachannel = (e) => {
        if (pcRef.current !== pc) return;
        setupChannel(e.channel);
      };

      const queueIce = createIceBatcher((candidates) => {
        if (pcRef.current === pc) signal.send({ type: 'ice', to: attemptId, candidates });
      });
      pc.onicecandidate = (e) => {
        if (e.candidate && pcRef.current === pc) queueIce(e.candidate.toJSON());
      };

      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc || isCleanedUpRef.current) return;
        console.log('Laptop connection state:', pc.connectionState);
        if (pc.connectionState === 'failed') {
          setConnectionState(CONNECTION_STATES.PAIRING);
          setConnectionStatusText('Could not connect to the phone. Check both devices are on the same Wi-Fi and scan again.');
        }
      };

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
        await flushCandidates(pc, attemptId);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pcRef.current !== pc) return;
        answers.set(attemptId, answer.sdp);
        await signal.send({ type: 'answer', to: attemptId, sdp: answer.sdp });
      } catch (err) {
        console.error('Laptop failed to answer offer:', err);
        if (pcRef.current === pc) {
          setConnectionStatusText('Pairing failed. Scan the QR code again.');
        }
      }
    };

    const handlePhoneSignal = (msg) => {
      if (!msg.from) return;
      if (msg.type === 'offer' && msg.sdp) {
        answerOffer(msg, signal);
      } else if (msg.type === 'ice') {
        const pc = pcRef.current;
        for (const candidate of candidatesOf(msg)) {
          if (pc && attemptRef.current === msg.from && pc.remoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          } else {
            // ICE can arrive before its offer — keep it until the offer shows up
            pendingCandidates.current.push({ attemptId: msg.from, candidate });
          }
        }
      }
    };

    const signal = createSignalChannel({ sessionId: id, role: 'laptop', onMessage: handlePhoneSignal });
    signalRef.current = signal;
  }, [cleanup, closePeer, setupChannel, flushCandidates]);

  /**
   * Phone: connect to the laptop session from the QR code.
   */
  const joinLaptopSession = useCallback(async (laptopSessionId) => {
    if (!laptopSessionId) return;

    cleanup();
    isCleanedUpRef.current = false;

    const attemptId = randomId('p-', 10);
    attemptRef.current = attemptId;
    const isCurrent = () => attemptRef.current === attemptId && !isCleanedUpRef.current;

    setConnectionState(CONNECTION_STATES.CONNECTING);
    setConnectionStatusText('Reaching your laptop...');
    setError(null);

    let answered = false;

    const handleLaptopSignal = async (msg) => {
      if (!isCurrent() || msg.to !== attemptId) return;
      const pc = pcRef.current;
      if (!pc) return;

      if (msg.type === 'answer' && msg.sdp) {
        if (pc.signalingState !== 'have-local-offer') return; // duplicate answer
        try {
          answered = true;
          setConnectionStatusText('Laptop found — connecting...');
          await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
          await flushCandidates(pc, attemptId);
        } catch (err) {
          console.error('Phone failed to apply answer:', err);
        }
      } else if (msg.type === 'ice') {
        for (const candidate of candidatesOf(msg)) {
          if (pc.remoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          } else {
            pendingCandidates.current.push({ attemptId, candidate });
          }
        }
      }
    };

    try {
      const signal = createSignalChannel({ sessionId: laptopSessionId, role: 'phone', onMessage: handleLaptopSignal });
      signalRef.current = signal;

      // Subscribe before sending the offer, so the laptop's answer can't be missed
      await signal.ready;
      if (!isCurrent()) return;

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcRef.current = pc;

      // Phone creates the DataChannel; signaling is no longer needed once it opens
      const channel = pc.createDataChannel('streamly', { ordered: true });
      setupChannel(channel, () => {
        if (signalRef.current === signal) {
          signal.close();
          signalRef.current = null;
        }
      });

      const queueIce = createIceBatcher((candidates) => {
        if (pcRef.current === pc) signal.send({ type: 'ice', from: attemptId, candidates });
      });
      pc.onicecandidate = (e) => {
        if (e.candidate && pcRef.current === pc) queueIce(e.candidate.toJSON());
      };

      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc || !isCurrent()) return;
        console.log('Phone connection state:', pc.connectionState);
        if (pc.connectionState === 'failed') {
          handleError('Could not connect directly to your laptop. ' + NETWORK_HINT);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (!isCurrent()) return;

      const offerMsg = { type: 'offer', from: attemptId, sdp: offer.sdp };
      const sent = await signal.send(offerMsg);
      if (!isCurrent()) return;
      if (!sent) {
        handleError('Could not reach the pairing service. Check your internet connection and tap Retry.');
        return;
      }
      console.log('Phone sent offer to laptop');
      setConnectionStatusText('Waiting for laptop to respond...');

      // Re-send the offer if the laptop hasn't answered yet
      OFFER_RESEND_MS.forEach((ms) => addTimer(() => {
        if (isCurrent() && !answered) signal.send(offerMsg);
      }, ms));

      addTimer(() => {
        if (!isCurrent()) return;
        if (channelRef.current && channelRef.current.readyState === 'open') return;
        handleError(answered
          ? 'Found your laptop but could not open a direct connection. ' + NETWORK_HINT
          : 'Laptop did not respond. Make sure the Streamly page is still open on your laptop (or refresh it for a new QR code), then tap Retry.');
      }, CONNECT_TIMEOUT_MS);
    } catch (err) {
      if (isCurrent()) handleError('Failed to connect: ' + err.message);
    }
  }, [cleanup, setupChannel, flushCandidates, handleError, addTimer]);

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
