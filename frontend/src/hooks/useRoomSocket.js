import { useCallback, useEffect, useRef, useState } from 'react';
import { createSocket, emitWithAck, measureClockOffset } from '../lib/socket.js';

const selfKey = (roomId) => `streamly:self:${roomId}`;
function loadSelfIds(roomId) {
  try {
    const list = JSON.parse(sessionStorage.getItem(selfKey(roomId)) || '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function saveSelfIds(roomId, set) {
  try {
    sessionStorage.setItem(selfKey(roomId), JSON.stringify([...set].slice(-50)));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Owns the Socket.IO connection for a room: clock sync, join / re-join on reconnect,
 * presence of the other participant, and chat history.
 *
 * status: 'connecting' | 'joined' | 'reconnecting' | 'full' | 'error'
 * joinInfo: { selfId, state, seq } — a new object after every successful (re)join.
 * peer: { id, name, cam, mic, initiator } — initiator=true means WE are the newcomer (we offer).
 */
export default function useRoomSocket(roomId, name) {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [joinInfo, setJoinInfo] = useState(null);
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatNotice, setChatNotice] = useState(null);
  const noticeTimer = useRef(null);
  const clockOffsetRef = useRef(0);
  const selfIdsRef = useRef(new Set());
  const socketRef = useRef(null);
  const fullRef = useRef(false);

  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, []);

  useEffect(() => {
    if (!roomId || !name) return undefined;
    // Previous socket ids from this tab, so our own chat history stays "ours" after a reload.
    loadSelfIds(roomId).forEach((id) => selfIdsRef.current.add(id));
    const s = createSocket();
    socketRef.current = s;
    setSocket(s);
    setStatus('connecting');
    let disposed = false;
    let joinSeq = 0;
    fullRef.current = false;
    // Stable across reconnects of this connection so the server can evict our own stale member
    // if we reconnect (new socket id) before it noticed the old socket dropped.
    const clientId =
      (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
      `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const join = async () => {
      const seq = ++joinSeq;
      try {
        clockOffsetRef.current = await measureClockOffset(s, 5);
      } catch {
        /* keep previous offset */
      }
      if (disposed || seq !== joinSeq || !s.connected) return;
      let res;
      try {
        res = await emitWithAck(s, 'room:join', { roomId, name, clientId }, 10000);
      } catch {
        res = null;
      }
      if (disposed || seq !== joinSeq) return;
      if (!res) {
        // Ack timed out: retry while still connected.
        if (s.connected) setTimeout(() => !disposed && s.connected && seq === joinSeq && join(), 1500);
        return;
      }
      if (!res.ok) {
        if (res.error === 'ROOM_FULL') {
          fullRef.current = true;
          setStatus('full');
          s.disconnect();
        } else {
          setError(res.error || 'BAD_REQUEST');
          setStatus('error');
        }
        return;
      }
      selfIdsRef.current.add(res.selfId);
      saveSelfIds(roomId, selfIdsRef.current);
      const existing = Array.isArray(res.peers) ? res.peers.find((p) => p && p.id !== res.selfId) : null;
      setPeer(existing ? { ...existing, initiator: true } : null);
      setMessages(Array.isArray(res.messages) ? res.messages : []);
      setJoinInfo({ selfId: res.selfId, state: res.state, seq });
      setError(null);
      setStatus('joined');
    };

    const onConnect = () => {
      if (fullRef.current) return;
      join();
    };
    const onDisconnect = (reason) => {
      if (disposed) return;
      joinSeq += 1; // cancel any in-flight join
      setPeer(null);
      if (!fullRef.current) setStatus((st) => (st === 'full' ? st : 'reconnecting'));
      // A server-side disconnect does not auto-reconnect.
      if (reason === 'io server disconnect' && !fullRef.current) s.connect();
    };
    const onConnectError = () => {
      if (disposed || fullRef.current) return;
      setStatus((st) => (st === 'joined' || st === 'reconnecting' ? 'reconnecting' : 'connecting'));
    };
    const onPeerJoined = (p) => {
      if (!p?.id) return;
      setPeer({ ...p, initiator: false });
    };
    const onPeerLeft = ({ id } = {}) => setPeer((p) => (p && p.id === id ? null : p));
    const onPeerMedia = ({ id, cam, mic } = {}) =>
      setPeer((p) => (p && p.id === id ? { ...p, cam: !!cam, mic: !!mic } : p));
    const onChat = (m) => {
      if (!m) return;
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m].slice(-200)));
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.on('peer:joined', onPeerJoined);
    s.on('peer:left', onPeerLeft);
    s.on('peer:media', onPeerMedia);
    const onChatRejected = () => {
      setChatNotice('You’re sending messages too fast. Wait a few seconds.');
      clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setChatNotice(null), 4000);
    };

    s.on('chat:message', onChat);
    s.on('chat:rejected', onChatRejected);

    return () => {
      disposed = true;
      try {
        if (s.connected) s.emit('room:leave');
      } catch {
        /* ignore */
      }
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.off('peer:joined', onPeerJoined);
      s.off('peer:left', onPeerLeft);
      s.off('peer:media', onPeerMedia);
      s.off('chat:message', onChat);
      s.off('chat:rejected', onChatRejected);
      clearTimeout(noticeTimer.current);
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setPeer(null);
    };
  }, [roomId, name]);

  const sendChat = useCallback((text) => {
    const t = String(text || '').trim().slice(0, 500);
    const s = socketRef.current;
    if (!t || !s?.connected) return false;
    s.emit('chat:send', { text: t });
    return true;
  }, []);

  const retry = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    fullRef.current = false;
    setStatus('connecting');
    if (s.connected) s.disconnect();
    s.connect(); // 'connect' handler re-runs clock sync + room:join

  }, []);

  const isOwnMessage = useCallback((m) => selfIdsRef.current.has(m?.from), []);

  return { socket, status, error, joinInfo, peer, messages, chatNotice, serverNow, sendChat, retry, isOwnMessage };
}
