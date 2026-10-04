import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * ICE server list (STUN + TURN) for WebRTC.
 *
 * STUN only works when the devices can reach each other directly (same Wi-Fi).
 * When the laptop is on the phone's hotspot and the phone is on mobile data,
 * a TURN relay is required. Configure one of these (Vercel → Settings → Environment Variables):
 *
 *   Cloudflare TURN (free 1 TB/month):  CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN
 *   Metered TURN (free 20 GB/month):    METERED_DOMAIN (e.g. myapp.metered.live), METERED_API_KEY
 *   Any static TURN server:             TURN_URL (comma separated), TURN_USERNAME, TURN_CREDENTIAL
 *
 * Without any of these, a free public relay is used on a best-effort basis.
 */

const STUN_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// Best-effort public relay, used only when nothing is configured
const PUBLIC_TURN = {
  urls: [
    'turn:openrelay.metered.ca:80',
    'turn:openrelay.metered.ca:443',
    'turn:openrelay.metered.ca:443?transport=tcp',
    'turns:openrelay.metered.ca:443?transport=tcp',
  ],
  username: 'openrelayproject',
  credential: 'openrelayproject',
};

async function fetchWithTimeout(url, options = {}, ms = 5000) {
  return fetch(url, { ...options, cache: 'no-store', signal: AbortSignal.timeout(ms) });
}

async function cloudflareTurn() {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return null;

  const res = await fetchWithTimeout(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }),
    }
  );
  if (!res.ok) throw new Error(`Cloudflare TURN ${res.status}`);
  const data = await res.json();
  const servers = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
  return servers.filter(Boolean);
}

async function meteredTurn() {
  const domain = process.env.METERED_DOMAIN;
  const apiKey = process.env.METERED_API_KEY;
  if (!domain || !apiKey) return null;

  const res = await fetchWithTimeout(
    `https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) throw new Error(`Metered TURN ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : null;
}

function staticTurn() {
  const url = process.env.TURN_URL || process.env.NEXT_PUBLIC_TURN_URL;
  if (!url) return null;
  return [{
    urls: url.split(',').map((u) => u.trim()).filter(Boolean),
    username: process.env.TURN_USERNAME || process.env.NEXT_PUBLIC_TURN_USERNAME || '',
    credential: process.env.TURN_CREDENTIAL || process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
  }];
}

export async function GET() {
  let turn = null;
  for (const provider of [cloudflareTurn, meteredTurn]) {
    try {
      turn = await provider();
      if (turn && turn.length) break;
    } catch (err) {
      console.error('TURN provider failed:', err.message);
    }
  }
  if (!turn || !turn.length) turn = staticTurn();
  const configured = !!(turn && turn.length);

  return NextResponse.json(
    { iceServers: [...STUN_SERVERS, ...(configured ? turn : [PUBLIC_TURN])], turnConfigured: configured },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
