import { WebSocketServer } from 'ws';

const port = Number(process.env.SIGNALING_PORT || 8787);
const rooms = new Map();
const roomTimers = new Map();
const ROOM_TTL_MS = 10 * 60 * 1000;

function validRoom(room) {
  return typeof room === 'string' && /^\d{6}$/.test(room);
}

function send(socket, type, data) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify({ type, data }));
  }
}

const server = new WebSocketServer({ port });

server.on('connection', (socket) => {
  let room;
  let role;

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'join') {
        if (!validRoom(message.room) || !['phone', 'laptop'].includes(message.role)) {
          send(socket, 'error', 'Invalid pairing session.');
          socket.close();
          return;
        }

        room = message.room;
        role = message.role;
        const peers = rooms.get(room) || new Map();
        if (peers.has(role)) {
          send(socket, 'error', 'This pairing session is already in use.');
          socket.close();
          return;
        }
        peers.set(role, socket);
        rooms.set(room, peers);
        if (!roomTimers.has(room)) {
          roomTimers.set(room, setTimeout(() => {
            const expiredPeers = rooms.get(room);
            expiredPeers?.forEach((peer) => peer.close());
            rooms.delete(room);
            roomTimers.delete(room);
          }, ROOM_TTL_MS));
        }
        send(socket, 'joined');
        return;
      }

      if (!room || !['offer', 'answer', 'ice'].includes(message.type)) return;
      const peer = rooms.get(room)?.get(role === 'phone' ? 'laptop' : 'phone');
      if (peer) send(peer, message.type, message.data);
    } catch {
      send(socket, 'error', 'Invalid signaling message.');
    }
  });

  socket.on('close', () => {
    if (!room) return;
    const peers = rooms.get(room);
    if (!peers) return;
    peers.delete(role);
    if (peers.size === 0) {
      rooms.delete(room);
      clearTimeout(roomTimers.get(room));
      roomTimers.delete(room);
    }
  });
});

setInterval(() => {
  for (const [room, peers] of rooms) {
    for (const socket of peers.values()) {
      if (socket.readyState !== 1) socket.close();
    }
    if (peers.size === 0) {
      rooms.delete(room);
      clearTimeout(roomTimers.get(room));
      roomTimers.delete(room);
    }
  }
}, ROOM_TTL_MS).unref();

console.log(`Streamly signaling server listening on ws://0.0.0.0:${port}`);
