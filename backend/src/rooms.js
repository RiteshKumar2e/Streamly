// In-memory room store for Streamly watch parties.
import crypto from 'node:crypto';

export const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_ID_LENGTH = 6;
export const MAX_MEMBERS = 2;
export const MAX_MESSAGES = 100;
export const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

/** @type {Map<string, Room>} */
const rooms = new Map();

function initialState() {
  return { source: null, playing: false, time: 0, rate: 1, updatedAt: Date.now() };
}

function randomId() {
  const bytes = crypto.randomBytes(ROOM_ID_LENGTH);
  let id = '';
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[bytes[i] % ROOM_ID_ALPHABET.length];
  }
  return id;
}

/** Generate a room id that is not currently in use. */
export function generateRoomId() {
  for (let i = 0; i < 1000; i++) {
    const id = randomId();
    if (!rooms.has(id)) return id;
  }
  throw new Error('Unable to generate unique room id');
}

/** Normalize a client-provided room id: uppercase alphanumerics only, max 12 chars. */
export function normalizeRoomId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export function getRoom(id) {
  return rooms.get(id) || null;
}

function scheduleCleanup(room) {
  clearCleanup(room);
  room.cleanupTimer = setTimeout(() => {
    const current = rooms.get(room.id);
    if (current === room && room.members.size === 0) rooms.delete(room.id);
  }, EMPTY_ROOM_TTL_MS);
  room.cleanupTimer.unref?.();
}

function clearCleanup(room) {
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}

/** Create a room. If id is omitted a fresh one is generated. Empty rooms auto-expire. */
export function createRoom(id = generateRoomId()) {
  const existing = rooms.get(id);
  if (existing) return existing;
  const room = {
    id,
    members: new Map(),
    state: initialState(),
    messages: [],
    cleanupTimer: null,
  };
  rooms.set(id, room);
  // A freshly created room has no members yet; expire it if nobody joins.
  scheduleCleanup(room);
  return room;
}

export function getOrCreateRoom(id) {
  return rooms.get(id) || createRoom(id);
}

/**
 * Add a member. Returns { ok:true, room } or { ok:false, error:'ROOM_FULL' }.
 */
export function addMember(roomId, member) {
  const room = getOrCreateRoom(roomId);
  if (!room.members.has(member.id) && room.members.size >= MAX_MEMBERS) {
    return { ok: false, error: 'ROOM_FULL' };
  }
  clearCleanup(room);
  room.members.set(member.id, member);
  return { ok: true, room };
}

/** Remove a member; schedules cleanup when the room becomes empty. Returns the room or null. */
export function removeMember(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const removed = room.members.delete(socketId);
  if (room.members.size === 0) scheduleCleanup(room);
  return removed ? room : null;
}

export function roomInfo(rawId) {
  const room = rooms.get(normalizeRoomId(rawId));
  const count = room ? room.members.size : 0;
  return { exists: !!room, count, full: count >= MAX_MEMBERS };
}

export function publicMember(m) {
  return { id: m.id, name: m.name, cam: m.cam, mic: m.mic };
}

export function addMessage(room, msg) {
  room.messages.push(msg);
  if (room.messages.length > MAX_MESSAGES) {
    room.messages.splice(0, room.messages.length - MAX_MESSAGES);
  }
}
