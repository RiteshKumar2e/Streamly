/**
 * Streamly — Signaling Relay
 *
 * Exchanges WebRTC offer/answer/ICE messages between laptop and phone through
 * ntfy.sh topics. The browser talks to ntfy.sh directly (it allows CORS):
 *   - receive: one long-lived EventSource (SSE) subscription — instant, and it
 *     doesn't burn through ntfy's per-IP request rate limit like fast polling does
 *   - send: a plain POST (text/plain body, so no CORS preflight)
 *
 * Polling only runs while the SSE stream is down, and backs off on errors.
 * The /api/signal route is used only when ntfy.sh is unreachable from the
 * browser (blocked network) — never on a 429, since that would just add load.
 *
 * Topics: streamly-<sessionId>-<role> holds the messages *for* that role.
 */

const NTFY_BASE = 'https://ntfy.sh';
const POLL_MIN_MS = 3000;
const POLL_MAX_MS = 30000;
const READY_TIMEOUT_MS = 4000;

function topicFor(sessionId, role) {
  return `streamly-${sessionId}-${role}`;
}

function peerRole(role) {
  return role === 'phone' ? 'laptop' : 'phone';
}

/**
 * Open a signaling channel.
 *
 * @param {object} opts
 * @param {string} opts.sessionId - Shared session id (from the QR code)
 * @param {'laptop'|'phone'} opts.role - Our own role
 * @param {(msg: object) => void} opts.onMessage - Called once per message from the peer
 * @returns {{ ready: Promise<boolean>, send: (msg: object) => Promise<boolean>, close: () => void }}
 */
export function createSignalChannel({ sessionId, role, onMessage }) {
  const ownTopic = topicFor(sessionId, role);
  const peerTopic = topicFor(sessionId, peerRole(role));
  const seenIds = new Set();
  let closed = false;
  let eventSource = null;
  let pollTimer = null;
  let pollDelay = POLL_MIN_MS;

  const deliver = (item) => {
    if (closed || !item || item.event !== 'message' || !item.message) return;
    if (item.id) {
      if (seenIds.has(item.id)) return;
      seenIds.add(item.id);
    }
    let parsed;
    try {
      parsed = typeof item.message === 'string' ? JSON.parse(item.message) : item.message;
    } catch {
      return;
    }
    if (parsed && parsed.type) {
      try {
        onMessage(parsed);
      } catch (err) {
        console.error('Signal handler error:', err);
      }
    }
  };

  // Returns true on success. Throws only when ntfy.sh is unreachable.
  const pollDirect = async () => {
    const res = await fetch(`${NTFY_BASE}/${ownTopic}/json?poll=1&since=all`, { cache: 'no-store' });
    if (!res.ok) return false; // e.g. 429 — back off, don't hit the fallback
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { deliver(JSON.parse(line)); } catch {}
    }
    return true;
  };

  const pollViaApi = async () => {
    try {
      const res = await fetch(
        `/api/signal?sessionId=${encodeURIComponent(sessionId)}&role=${encodeURIComponent(role)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return false;
      const data = await res.json();
      (data.messages || []).forEach((msg) => {
        if (msg && msg.type) deliver({ event: 'message', id: msg.id, message: msg });
      });
      return true;
    } catch {
      return false;
    }
  };

  const sseHealthy = () => eventSource && eventSource.readyState === 1;

  const schedulePoll = () => {
    if (closed || pollTimer || sseHealthy()) return;
    pollTimer = setTimeout(async () => {
      pollTimer = null;
      if (closed || sseHealthy()) return;
      let ok;
      try {
        ok = await pollDirect();
      } catch {
        ok = await pollViaApi();
      }
      pollDelay = ok ? POLL_MIN_MS : Math.min(pollDelay * 2, POLL_MAX_MS);
      schedulePoll();
    }, pollDelay);
  };

  const ready = new Promise((resolve) => {
    let settled = false;
    const settle = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        eventSource = new EventSource(`${NTFY_BASE}/${ownTopic}/sse?since=all`);
        eventSource.onopen = () => {
          pollDelay = POLL_MIN_MS;
          if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
          }
          settle(true);
        };
        eventSource.onmessage = (e) => {
          try { deliver(JSON.parse(e.data)); } catch {}
        };
        eventSource.onerror = () => {
          // EventSource retries by itself; poll (with backoff) until it's back
          schedulePoll();
        };
      } catch {
        eventSource = null;
      }
    }

    if (!eventSource) {
      pollDelay = 0;
      schedulePoll();
      pollDelay = POLL_MIN_MS;
      settle(false);
    }

    // Don't block forever if SSE is blocked on this network — polling covers it
    setTimeout(() => {
      schedulePoll();
      settle(false);
    }, READY_TIMEOUT_MS);
  });

  // 'ok' | 'retry' (rate limited / server error) | 'unreachable'
  const sendDirect = async (payload) => {
    try {
      const res = await fetch(`${NTFY_BASE}/${peerTopic}`, {
        method: 'POST',
        body: payload,
        cache: 'no-store',
      });
      return res.ok ? 'ok' : 'retry';
    } catch {
      return 'unreachable';
    }
  };

  const sendViaApi = async (message) => {
    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role, message }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const send = async (message) => {
    if (closed) return false;
    const payload = JSON.stringify(message);
    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await sendDirect(payload);
      if (result === 'ok') return true;
      if (result === 'unreachable' && await sendViaApi(message)) return true;
      if (closed) return false;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      if (closed) return false;
    }
    console.error('Failed to deliver signal:', message.type);
    return false;
  };

  return {
    ready,
    send,
    close() {
      closed = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    },
  };
}
