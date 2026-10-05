// ICE servers for WebRTC. STUN alone fails across many networks (mobile data, strict routers),
// so a TURN relay is needed for the video call to connect there.
//
// Sources, in order:
//  1. Cloudflare Realtime TURN (free tier) — set CF_TURN_KEY_ID + CF_TURN_API_TOKEN.
//     Short-lived credentials are generated server-side and cached.
//  2. Static TURN — TURN_URL (comma list) + TURN_USERNAME + TURN_CREDENTIAL (e.g. metered.ca).
//  3. Google STUN only.

const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] };
const CF_TTL_S = 24 * 60 * 60; // credential lifetime
const CF_REFRESH_MS = 12 * 60 * 60 * 1000; // regenerate well before expiry

let cfCache = null; // { servers, at }
let cfInflight = null;

function staticTurn() {
  const urls = (process.env.TURN_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!urls.length) return null;
  const turn = { urls };
  if (process.env.TURN_USERNAME) turn.username = process.env.TURN_USERNAME;
  if (process.env.TURN_CREDENTIAL) turn.credential = process.env.TURN_CREDENTIAL;
  return turn;
}

async function fetchCloudflare(keyId, token) {
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: CF_TTL_S }),
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) throw new Error(`Cloudflare TURN responded ${res.status}`);
  const body = await res.json();
  const list = Array.isArray(body.iceServers) ? body.iceServers : body.iceServers ? [body.iceServers] : [];
  // Browsers time out on port 53 URLs; drop them (Cloudflare's docs recommend this too).
  return list
    .map((s) => ({ ...s, urls: [].concat(s.urls || []).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length);
}

async function cloudflareServers() {
  const keyId = process.env.CF_TURN_KEY_ID;
  const token = process.env.CF_TURN_API_TOKEN;
  if (!keyId || !token) return null;
  if (cfCache && Date.now() - cfCache.at < CF_REFRESH_MS) return cfCache.servers;
  if (!cfInflight) {
    cfInflight = fetchCloudflare(keyId, token)
      .then((servers) => {
        cfCache = { servers, at: Date.now() };
        return servers;
      })
      .catch((err) => {
        console.warn('[ice] Cloudflare TURN failed:', err.message);
        return cfCache?.servers || null; // keep serving the last good credentials
      })
      .finally(() => {
        cfInflight = null;
      });
  }
  return cfInflight;
}

export async function getIceServers() {
  const servers = [STUN];
  const cf = await cloudflareServers();
  if (cf?.length) servers.push(...cf);
  const turn = staticTurn();
  if (turn) servers.push(turn);
  return servers;
}

export function turnConfigured() {
  return !!((process.env.CF_TURN_KEY_ID && process.env.CF_TURN_API_TOKEN) || process.env.TURN_URL);
}
