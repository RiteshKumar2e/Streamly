/**
 * Streamly — Local Hub (server side, local mode only)
 *
 * When Streamly runs on the laptop itself (`npm run dev` / `npm start`), the phone
 * opens the laptop's LAN address (e.g. over the phone's hotspot) and everything —
 * pairing, remote control and the video upload — goes straight to this server.
 * No internet, ntfy.sh, WebRTC or TURN involved.
 *
 * State lives on globalThis so every API route shares it (Next bundles each
 * route separately in dev, which would otherwise give each its own copy).
 */

import os from 'os';
import path from 'path';
import fs from 'fs';

const hub = globalThis.__streamlyLocalHub || (globalThis.__streamlyLocalHub = {
  sessions: new Map(),
});

export const SESSION_RE = /^stream-[a-z0-9]{4,32}$/;

export function isLocalServer() {
  return !process.env.VERCEL;
}

export function getSession(id) {
  let session = hub.sessions.get(id);
  if (!session) {
    session = { listeners: { laptop: new Set(), phone: new Set() }, video: null };
    hub.sessions.set(id, session);
  }
  return session;
}

export function otherRole(role) {
  return role === 'phone' ? 'laptop' : 'phone';
}

export function isOnline(id, role) {
  const session = hub.sessions.get(id);
  return !!session && session.listeners[role].size > 0;
}

export function publish(id, toRole, event) {
  const session = hub.sessions.get(id);
  if (!session) return;
  for (const send of session.listeners[toRole]) {
    try { send(event); } catch {}
  }
}

export function subscribe(id, role, send) {
  const session = getSession(id);
  session.listeners[role].add(send);
  return () => session.listeners[role].delete(send);
}

/** Temp file for a session's video. */
export function videoPath(id) {
  return path.join(os.tmpdir(), `streamly-${id}.video`);
}

/** Only one movie is kept at a time — delete any other Streamly temp videos. */
export function removeOldVideos(keepId) {
  const dir = os.tmpdir();
  let files = [];
  try { files = fs.readdirSync(dir); } catch { return; }
  for (const file of files) {
    if (file.startsWith('streamly-') && file.endsWith('.video') && file !== `streamly-${keepId}.video`) {
      try { fs.unlinkSync(path.join(dir, file)); } catch {}
    }
  }
  for (const [id, session] of hub.sessions) {
    if (id !== keepId) session.video = null;
  }
}

/** Private IPv4 addresses of this machine that a phone on the same network can reach. */
export function getLanAddresses() {
  const result = [];
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs || []) {
      if (addr.family !== 'IPv4' && addr.family !== 4) continue;
      if (addr.internal) continue;
      const ip = addr.address;
      if (ip.startsWith('169.254.')) continue;
      const isPrivate = ip.startsWith('10.') || ip.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
      if (!isPrivate) continue;
      // Skip virtual adapters (WSL, Hyper-V, VirtualBox, VMware, Docker)
      const virtual = /vEthernet|WSL|Hyper-V|VirtualBox|VMware|Docker|vboxnet|br-|veth/i.test(name);
      result.push({ ip, name, virtual });
    }
  }
  // Real Wi-Fi/Ethernet adapters first
  result.sort((a, b) => Number(a.virtual) - Number(b.virtual)
    || Number(!/wi-?fi|wlan|wireless/i.test(a.name)) - Number(!/wi-?fi|wlan|wireless/i.test(b.name)));
  return result;
}
