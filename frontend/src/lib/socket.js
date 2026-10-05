import { io } from 'socket.io-client';
import { BACKEND_URL } from './api.js';

/** Create the Socket.IO client exactly as the contract specifies. */
export function createSocket() {
  return io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}

/** Emit an event and resolve with the ack value (rejects on timeout). */
export function emitWithAck(socket, event, payload, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const args = payload === undefined ? [] : [payload];
    socket.timeout(timeout).emit(event, ...args, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

/**
 * Estimate (serverClock - localClock) in ms using several `clock:ping` samples.
 * The sample with the smallest round-trip time wins (least queuing noise).
 */
export async function measureClockOffset(socket, samples = 5) {
  let best = null;
  for (let i = 0; i < samples; i += 1) {
    if (!socket.connected) break;
    const t0 = Date.now();
    let serverNow;
    try {
      serverNow = await emitWithAck(socket, 'clock:ping', undefined, 3000);
    } catch {
      continue;
    }
    const t1 = Date.now();
    if (typeof serverNow !== 'number' || !Number.isFinite(serverNow)) continue;
    const rtt = t1 - t0;
    const offset = serverNow - (t0 + rtt / 2);
    if (!best || rtt < best.rtt) best = { rtt, offset };
  }
  return best ? best.offset : 0;
}
