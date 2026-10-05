// Socket.IO handlers implementing the Streamly contract (see CONTRACT.md).
import crypto from 'node:crypto';
import {
  addMember,
  addMessage,
  getRoom,
  normalizeRoomId,
  publicMember,
  removeMember,
} from './rooms.js';
import { TokenBucket, clientIpFromSocket, createConnectionCounter } from './rateLimit.js';

const MAX_NAME = 32;

// ---------- abuse limits ----------

const MAX_CONNECTIONS_PER_IP = 20;
const CHAT_DUPLICATE_MS = 3000;
/** Per-socket event limits: [events, windowMs]. */
const SOCKET_LIMITS = {
  'room:join': [10, 60_000],
  'chat:send': [5, 5_000],
  'sync:action': [20, 1_000],
  signal: [200, 10_000],
  'media:status': [20, 10_000],
  'clock:ping': [30, 10_000],
};

// C0/C1 control characters plus bidi override/isolate characters (used for text spoofing).
// Normal unicode, emoji and ZWJ sequences are kept.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;
const stripControl = (s) => s.replace(CONTROL_CHARS, '');
const MAX_CHAT = 500;
const MAX_URL = 2000;
const MAX_FILE_NAME = 260;
const MAX_TITLE = 300;

// ---------- validation helpers ----------

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function cleanName(raw) {
  if (typeof raw !== 'string') return 'Guest';
  const name = stripControl(raw).trim().slice(0, MAX_NAME).trim();
  return name || 'Guest';
}

function cleanString(raw, max) {
  if (typeof raw !== 'string') return '';
  return stripControl(raw).trim().slice(0, max);
}

/** Finite, non-negative number or null. */
function cleanTime(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

function cleanRate(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(4, Math.max(0.25, v));
}

/** Returns a sanitized Source, null (explicit clear), or undefined (invalid). */
function cleanSource(src) {
  if (src === null) return null;
  if (!isObj(src)) return undefined;
  if (src.kind === 'url') {
    if (typeof src.url !== 'string') return undefined;
    const url = src.url.trim();
    if (!url || url.length > MAX_URL) return undefined;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return undefined;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return { kind: 'url', url, title: cleanString(src.title, MAX_TITLE) };
  }
  if (src.kind === 'file') {
    const name = cleanString(src.name, MAX_FILE_NAME);
    const size = cleanTime(src.size);
    if (!name || size === null) return undefined;
    return { kind: 'file', name, size, title: cleanString(src.title, MAX_TITLE) };
  }
  return undefined;
}

/** Validate a SyncAction payload. Returns a sanitized action or null. */
function cleanAction(a) {
  if (!isObj(a)) return null;
  switch (a.type) {
    case 'play':
    case 'pause':
    case 'seek': {
      const time = cleanTime(a.time);
      return time === null ? null : { type: a.type, time };
    }
    case 'rate': {
      const rate = cleanRate(a.rate);
      const time = cleanTime(a.time);
      return rate === null || time === null ? null : { type: 'rate', rate, time };
    }
    case 'source': {
      const source = cleanSource(a.source);
      return source === undefined ? null : { type: 'source', source };
    }
    default:
      return null;
  }
}

function applyAction(state, action, now) {
  state.updatedAt = now;
  switch (action.type) {
    case 'play':
      state.time = action.time;
      state.playing = true;
      break;
    case 'pause':
      state.time = action.time;
      state.playing = false;
      break;
    case 'seek':
      state.time = action.time;
      break;
    case 'rate':
      state.time = action.time;
      state.rate = action.rate;
      break;
    case 'source':
      state.source = action.source;
      state.time = 0;
      state.playing = false;
      state.rate = 1;
      break;
  }
}

const safeAck = (ack) => (typeof ack === 'function' ? ack : () => {});

// ---------- handlers ----------

export function registerSocketHandlers(io) {
  const connections = createConnectionCounter(MAX_CONNECTIONS_PER_IP);

  // Cap concurrent sockets per client IP. The slot is released when the socket disconnects.
  io.use((socket, next) => {
    const ip = clientIpFromSocket(socket);
    if (!connections.acquire(ip)) return next(new Error('RATE_LIMITED'));
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      connections.release(ip);
    };
    socket.on('disconnect', release);
    // If the handshake fails after this middleware, the socket never connects: release anyway.
    socket.conn.once('close', release);
    next();
  });

  io.on('connection', (socket) => {
    /** Current room id for this socket (one room at a time). */
    socket.data.roomId = null;

    // Per-socket token buckets; garbage-collected together with the socket.
    const buckets = {};
    for (const [event, [limit, windowMs]] of Object.entries(SOCKET_LIMITS)) {
      buckets[event] = new TokenBucket(limit, windowMs);
    }
    const allow = (event) => buckets[event].take();
    let lastChat = { text: '', at: 0 };

    const currentRoom = () => (socket.data.roomId ? getRoom(socket.data.roomId) : null);

    function leaveCurrentRoom() {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.data.roomId = null;
      socket.leave(roomId);
      const room = removeMember(roomId, socket.id);
      if (room) socket.to(roomId).emit('peer:left', { id: socket.id });
    }

    socket.on('clock:ping', (...args) => {
      if (!allow('clock:ping')) return;
      const ack = args.find((a) => typeof a === 'function');
      safeAck(ack)(Date.now());
    });

    socket.on('room:join', (payload, ack) => {
      ack = safeAck(typeof payload === 'function' ? payload : ack);
      if (!allow('room:join')) return ack({ ok: false, error: 'RATE_LIMITED' });
      if (!isObj(payload)) return ack({ ok: false, error: 'BAD_REQUEST' });
      const roomId = normalizeRoomId(payload.roomId);
      if (!roomId) return ack({ ok: false, error: 'BAD_REQUEST' });
      const name = cleanName(payload.name);

      // Rejoining the same room: just update and resend snapshot.
      if (socket.data.roomId && socket.data.roomId !== roomId) leaveCurrentRoom();

      const clientId = cleanString(payload.clientId, 64) || null;
      const existing = getRoom(roomId);

      // Same browser tab reconnecting with a new socket before the server noticed the old one
      // dropped (e.g. network blip): evict the stale member so the room isn't reported FULL.
      if (existing && clientId) {
        for (const m of [...existing.members.values()]) {
          if (m.id === socket.id || m.clientId !== clientId) continue;
          removeMember(roomId, m.id);
          const stale = io.sockets.sockets.get(m.id);
          if (stale) {
            stale.data.roomId = null;
            stale.leave(roomId);
            stale.disconnect(true);
          }
          io.to(roomId).emit('peer:left', { id: m.id });
        }
      }

      const prev = existing?.members.get(socket.id);
      const member = prev
        ? { ...prev, name }
        : { id: socket.id, clientId, name, cam: false, mic: false, joinedAt: Date.now() };

      const result = addMember(roomId, member);
      if (!result.ok) return ack({ ok: false, error: result.error });
      const { room } = result;

      socket.join(roomId);
      socket.data.roomId = roomId;

      const peers = [...room.members.values()]
        .filter((m) => m.id !== socket.id)
        .map(publicMember);

      if (!prev) socket.to(roomId).emit('peer:joined', publicMember(member));

      ack({
        ok: true,
        selfId: socket.id,
        roomId,
        peers,
        state: { ...room.state },
        messages: room.messages.slice(),
      });
    });

    socket.on('room:leave', () => leaveCurrentRoom());

    socket.on('signal', (payload) => {
      if (!allow('signal')) return;
      if (!isObj(payload) || typeof payload.to !== 'string' || !isObj(payload.data)) return;
      const room = currentRoom();
      if (!room || payload.to === socket.id) return;
      if (!room.members.has(socket.id) || !room.members.has(payload.to)) return;
      io.to(payload.to).emit('signal', { from: socket.id, data: payload.data });
    });

    socket.on('sync:action', (payload) => {
      if (!allow('sync:action')) return;
      const room = currentRoom();
      if (!room) return;
      const action = cleanAction(payload);
      if (!action) return;
      const now = Date.now();
      applyAction(room.state, action, now);
      const member = room.members.get(socket.id);
      socket.to(room.id).emit('sync:action', {
        ...action,
        from: socket.id,
        name: member?.name || 'Guest',
        serverTime: now,
      });
    });

    socket.on('sync:request', (...args) => {
      const ack = safeAck(args.find((a) => typeof a === 'function'));
      const room = currentRoom();
      if (!room) return ack(null);
      ack({ ...room.state });
    });

    socket.on('chat:send', (payload) => {
      const room = currentRoom();
      if (!room || !isObj(payload) || typeof payload.text !== 'string') return;
      const text = stripControl(payload.text).trim().slice(0, MAX_CHAT);
      if (!text) return;
      // Silently drop an exact repeat of this socket's previous message sent within 3s.
      const now = Date.now();
      if (text === lastChat.text && now - lastChat.at < CHAT_DUPLICATE_MS) return;
      if (!allow('chat:send')) {
        socket.emit('chat:rejected', { reason: 'RATE_LIMITED' });
        return;
      }
      lastChat = { text, at: now };
      const member = room.members.get(socket.id);
      const msg = {
        id: crypto.randomUUID(),
        from: socket.id,
        name: member?.name || 'Guest',
        text,
        ts: now,
      };
      addMessage(room, msg);
      io.to(room.id).emit('chat:message', msg);
    });

    socket.on('media:status', (payload) => {
      if (!allow('media:status')) return;
      const room = currentRoom();
      if (!room || !isObj(payload)) return;
      const member = room.members.get(socket.id);
      if (!member) return;
      if (typeof payload.cam === 'boolean') member.cam = payload.cam;
      if (typeof payload.mic === 'boolean') member.mic = payload.mic;
      socket.to(room.id).emit('peer:media', { id: socket.id, cam: member.cam, mic: member.mic });
    });

    socket.on('disconnect', () => leaveCurrentRoom());
  });
}
