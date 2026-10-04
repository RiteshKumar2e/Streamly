/**
 * Streamly — Signaling Relay
 *
 * Exchanges WebRTC offer/answer/ICE messages between laptop and phone through
 * ntfy.sh topics. The browser talks to ntfy.sh directly (it allows CORS):
 *   - receive: one long-lived EventSource (SSE) subscription — instant, and it
 *     doesn't burn through ntfy's per-IP request rate limit like fast polling does
 *   - send: a plain POST (text/plain body, so no CORS preflight)
 *
 * If direct access fails, it falls back to the /api/signal route on our own server.
 *
 * Topics: streamly-<sessionId>-<role> holds the messages *for* that role.
 */

const NTFY_BASE = 'https://ntfy.sh';
const BACKUP_POLL_MS = 3000;
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
 * @returns {{ ready: Promise<boolean>, send: (msg: object) => Promise<boolean>, setBackupPolling: (on: boolean) => void, close: () => void }}
 */
export function createSignalChannel({ sessionId, role, onMessage }) {
  const ownTopic = topicFor(sessionId, role);
  const peerTopic = topicFor(sessionId, peerRole(role));
  const seenIds = new Set();
  let closed = false;
  let eventSource = null;
  let pollTimer = null;
  let backupPolling = false;
  let pollInFlight = false;

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

  // Delivers already-parsed messages coming back from /api/signal
  const deliverParsed = (msg) => {
    if (!msg || !msg.type) return;
    deliver({ event: 'message', id: msg.id, message: msg });
  };

  const pollOnce = async () => {
    if (closed || pollInFlight) return;
    pollInFlight = true;
    try {
      const res = await fetch(`${NTFY_BASE}/${ownTopic}/json?poll=1&since=all`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`ntfy poll ${res.status}`);
      const text = await res.text();
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try { deliver(JSON.parse(line)); } catch {}
      }
    } catch {
      // Direct poll failed — go through our own API route
      try {
        const res = await fetch(
          `/api/signal?sessionId=${encodeURIComponent(sessionId)}&role=${encodeURIComponent(role)}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          (data.messages || []).forEach(deliverParsed);
        }
      } catch {}
    } finally {
      pollInFlight = false;
    }
  };

  const syncPolling = () => {
    const sseHealthy = eventSource && eventSource.readyState === 1;
    const shouldPoll = !closed && (backupPolling || !sseHealthy);
    if (shouldPoll && !pollTimer) {
      pollTimer = setInterval(pollOnce, BACKUP_POLL_MS);
      pollOnce();
    } else if (!shouldPoll && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
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
          syncPolling();
          settle(true);
        };
        eventSource.onmessage = (e) => {
          try { deliver(JSON.parse(e.data)); } catch {}
        };
        eventSource.onerror = () => {
          // EventSource reconnects on its own; poll meanwhile so nothing is missed
          syncPolling();
        };
      } catch {
        eventSource = null;
      }
    }

    if (!eventSource) {
      syncPolling();
      settle(false);
    }

    // Don't block forever if SSE is blocked on this network — polling covers it
    setTimeout(() => {
      syncPolling();
      settle(false);
    }, READY_TIMEOUT_MS);
  });

  const sendOnce = async (payload) => {
    try {
      const res = await fetch(`${NTFY_BASE}/${peerTopic}`, {
        method: 'POST',
        body: payload,
        cache: 'no-store',
      });
      if (res.ok) return true;
    } catch {}

    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role, message: JSON.parse(payload) }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const send = async (message) => {
    if (closed) return false;
    const payload = JSON.stringify(message);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await sendOnce(payload)) return true;
      if (closed) return false;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    console.error('Failed to deliver signal:', message.type);
    return false;
  };

  return {
    ready,
    send,
    setBackupPolling(on) {
      backupPolling = !!on;
      syncPolling();
    },
    close() {
      closed = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },
  };
}
