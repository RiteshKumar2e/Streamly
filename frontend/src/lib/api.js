// VITE_BACKEND_URL wins; otherwise production builds use the Render backend and dev uses localhost.
const DEFAULT_BACKEND = import.meta.env.PROD ? 'https://streamly-tdx8.onrender.com' : 'http://localhost:4000';
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND).replace(/\/+$/, '');

const FALLBACK_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

async function request(path, options) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function createRoom() {
  const { roomId } = await request('/api/rooms', { method: 'POST' });
  return roomId;
}

export function getRoom(roomId) {
  return request(`/api/rooms/${encodeURIComponent(roomId)}`);
}

export async function getIceServers() {
  try {
    const { iceServers } = await request('/api/ice');
    return iceServers?.length ? iceServers : FALLBACK_ICE;
  } catch {
    return FALLBACK_ICE;
  }
}

export function normalizeRoomId(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
