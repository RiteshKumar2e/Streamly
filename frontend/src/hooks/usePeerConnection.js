import { useEffect, useRef, useState } from 'react';
import { getIceServers } from '../lib/api.js';

const KINDS = ['audio', 'video'];

/**
 * One RTCPeerConnection per remote peer, using the "perfect negotiation" pattern.
 * - Newcomer (peer.initiator === true) is impolite and makes the initial offer.
 * - The peer that was in the room first is polite and only answers the first offer.
 */
export default function usePeerConnection({ socket, peer, localStream, mediaReady }) {
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('idle');
  const sessionRef = useRef(null);
  const pendingRef = useRef([]);
  const iceRef = useRef(null);
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;

  // Route incoming signals to the active session (buffer if it isn't created yet).
  useEffect(() => {
    if (!socket) return undefined;
    const onSignal = (msg) => {
      if (!msg?.from || !msg.data) return;
      const session = sessionRef.current;
      if (session && session.peerId === msg.from) {
        session.handleSignal(msg.data);
      } else {
        pendingRef.current.push(msg);
        if (pendingRef.current.length > 100) pendingRef.current.shift();
      }
    };
    socket.on('signal', onSignal);
    return () => socket.off('signal', onSignal);
  }, [socket]);

  const peerId = peer?.id || null;
  const polite = peer ? !peer.initiator : true;

  useEffect(() => {
    if (!socket || !peerId) {
      pendingRef.current = [];
      setRemoteStream(null);
      setConnectionState('idle');
      return undefined;
    }
    if (!mediaReady) {
      setConnectionState('waiting');
      return undefined;
    }
    if (!iceRef.current) iceRef.current = getIceServers();

    const session = createSession({
      socket,
      peerId,
      polite,
      localStream: localStreamRef.current,
      iceServersPromise: iceRef.current,
      onRemoteStream: setRemoteStream,
      onState: setConnectionState,
    });
    sessionRef.current = session;
    setConnectionState('connecting');

    // Drain signals that arrived before the session existed.
    const queued = pendingRef.current;
    pendingRef.current = [];
    queued.filter((m) => m.from === peerId).forEach((m) => session.handleSignal(m.data));

    return () => {
      session.close();
      if (sessionRef.current === session) sessionRef.current = null;
      setRemoteStream(null);
      setConnectionState('idle');
    };
  }, [socket, peerId, polite, mediaReady]);

  return { remoteStream, connectionState };
}

function createSession({ socket, peerId, polite, localStream, iceServersPromise, onRemoteStream, onState }) {
  let pc = null;
  let closed = false;
  let makingOffer = false;
  let ignoreOffer = false;
  let isSettingRemoteAnswerPending = false;
  let hadRemoteOffer = false;
  const remote = new MediaStream();

  const send = (data) => {
    if (!closed && socket.connected) socket.emit('signal', { to: peerId, data });
  };
  const publishRemote = () => {
    if (!closed) onRemoteStream(remote.getTracks().length ? new MediaStream(remote.getTracks()) : null);
  };
  const localTrack = (kind) =>
    localStream ? (kind === 'audio' ? localStream.getAudioTracks()[0] : localStream.getVideoTracks()[0]) : null;

  const start = (async () => {
    const iceServers = await iceServersPromise;
    if (closed) return;
    pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send({ candidate: candidate.toJSON ? candidate.toJSON() : candidate });
    };

    pc.ontrack = ({ track }) => {
      remote
        .getTracks()
        .filter((t) => t.kind === track.kind && t !== track)
        .forEach((t) => remote.removeTrack(t));
      if (!remote.getTracks().includes(track)) remote.addTrack(track);
      track.onunmute = publishRemote;
      track.onended = () => {
        remote.removeTrack(track);
        publishRemote();
      };
      publishRemote();
    };

    pc.onconnectionstatechange = () => {
      if (closed) return;
      const st = pc.connectionState;
      onState(st);
      if (st === 'failed' && typeof pc.restartIce === 'function') pc.restartIce();
    };

    pc.onnegotiationneeded = async () => {
      // The polite (existing) peer never starts the very first negotiation: the newcomer offers.
      if (polite && !hadRemoteOffer) return;
      try {
        makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) send({ description: plainDescription(pc.localDescription) });
      } catch (err) {
        console.warn('[rtc] negotiation failed', err);
      } finally {
        makingOffer = false;
      }
    };

    if (!polite) {
      // Newcomer: declare both kinds up front; send what we have, receive regardless.
      KINDS.forEach((kind) => {
        const track = localTrack(kind);
        if (track) pc.addTransceiver(track, { direction: 'sendrecv', streams: [localStream] });
        else pc.addTransceiver(kind, { direction: 'recvonly' });
      });
    }
  })();

  let chain = start.catch((err) => console.warn('[rtc] setup failed', err));

  // Polite side: after the first remote offer, attach our tracks to the offered transceivers.
  const attachLocalToOffer = async () => {
    for (const t of pc.getTransceivers()) {
      const kind = t.receiver?.track?.kind;
      if (!kind || t.stopped || t.sender.track) continue;
      const track = localTrack(kind);
      if (track) {
        await t.sender.replaceTrack(track);
        if (typeof t.sender.setStreams === 'function') t.sender.setStreams(localStream);
        t.direction = 'sendrecv';
      } else {
        t.direction = 'recvonly';
      }
    }
  };

  const handle = async (data) => {
    if (closed || !pc) return;
    const { description, candidate } = data || {};
    if (description) {
      const readyForOffer = !makingOffer && (pc.signalingState === 'stable' || isSettingRemoteAnswerPending);
      const offerCollision = description.type === 'offer' && !readyForOffer;
      ignoreOffer = !polite && offerCollision;
      if (ignoreOffer) return;
      isSettingRemoteAnswerPending = description.type === 'answer';
      await pc.setRemoteDescription(description);
      isSettingRemoteAnswerPending = false;
      if (description.type === 'offer') {
        if (polite && !hadRemoteOffer) await attachLocalToOffer();
        hadRemoteOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) send({ description: plainDescription(pc.localDescription) });
      }
    } else if (candidate) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        if (!ignoreOffer) console.warn('[rtc] addIceCandidate failed', err);
      }
    }
  };

  return {
    peerId,
    handleSignal(data) {
      chain = chain.then(() => handle(data)).catch((err) => console.warn('[rtc] signal error', err));
    },
    close() {
      closed = true;
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onnegotiationneeded = null;
        pc.onconnectionstatechange = null;
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      }
      remote.getTracks().forEach((t) => remote.removeTrack(t));
    },
  };
}

function plainDescription(d) {
  return { type: d.type, sdp: d.sdp };
}
