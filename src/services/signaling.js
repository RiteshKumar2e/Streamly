/**
 * Streamly — Signaling Service
 *
 * Since Streamly has NO backend server, WebRTC signaling must happen manually.
 *
 * This service provides two approaches:
 *
 * 1. **Manual Copy-Paste** (always works):
 *    - Phone creates an offer → user copies the SDP string
 *    - User pastes it into the laptop browser
 *    - Laptop creates an answer → user copies the SDP string
 *    - User pastes it back into the phone browser
 *    - Connection is established
 *
 * 2. **BroadcastChannel** (same-browser, same-origin only):
 *    - If both tabs are open in the same browser (e.g., testing on one machine),
 *      BroadcastChannel can exchange signaling data automatically.
 *    - This is useful for development/testing but NOT for real phone-to-laptop use.
 *
 * The architecture is designed so that a real signaling server (WebSocket, etc.)
 * can be plugged in later by implementing the SignalingProvider interface.
 */

/**
 * Generate a random 6-digit pairing code.
 */
export function generatePairingCode() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code.slice(0, 3) + ' ' + code.slice(3);
}

/**
 * Normalize a pairing code (remove spaces).
 */
export function normalizePairingCode(code) {
  return code.replace(/\s/g, '');
}

/**
 * Encode SDP to a compact shareable string.
 * We use base64 encoding of the JSON-stringified SDP.
 */
export function encodeSDP(sessionDescription) {
  const json = JSON.stringify({
    type: sessionDescription.type,
    sdp: sessionDescription.sdp,
  });
  return btoa(json);
}

/**
 * Decode a compact SDP string back to an object.
 */
export function decodeSDP(encoded) {
  try {
    const json = atob(encoded);
    const parsed = JSON.parse(json);
    if (parsed.type && parsed.sdp) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * BroadcastChannel-based signaling for same-browser testing.
 *
 * This creates a simple pub/sub over BroadcastChannel using the pairing code
 * as the channel name.
 */
export class BroadcastSignaling {
  constructor(pairingCode) {
    this.code = normalizePairingCode(pairingCode);
    this.channel = null;
    this.listeners = new Map();
  }

  connect() {
    if (!window.BroadcastChannel) {
      console.warn('BroadcastChannel not supported');
      return false;
    }

    this.channel = new BroadcastChannel(`streamly-${this.code}`);

    this.channel.onmessage = (event) => {
      const { type, data } = event.data;
      const handlers = this.listeners.get(type);
      if (handlers) {
        handlers.forEach((fn) => fn(data));
      }
    };

    return true;
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
  }

  off(type, callback) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  send(type, data) {
    if (this.channel) {
      this.channel.postMessage({ type, data });
    }
  }

  disconnect() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }
}

/**
 * Manual signaling helper — structures for the copy-paste flow.
 */
export class ManualSignaling {
  constructor() {
    this.offer = null;
    this.answer = null;
  }

  setOffer(sdp) {
    this.offer = encodeSDP(sdp);
  }

  setAnswer(sdp) {
    this.answer = encodeSDP(sdp);
  }

  getEncodedOffer() {
    return this.offer;
  }

  getEncodedAnswer() {
    return this.answer;
  }

  parseOffer(encoded) {
    return decodeSDP(encoded);
  }

  parseAnswer(encoded) {
    return decodeSDP(encoded);
  }
}
