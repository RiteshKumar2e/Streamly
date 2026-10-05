// Streamly backend: Express REST + Socket.IO signaling/sync server.
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createRoom, roomInfo } from './rooms.js';
import { registerSocketHandlers } from './socket.js';

// Load backend/.env when present (Node 20.12+/21.7+). Hosts like Render set env vars directly.
try {
  process.loadEnvFile?.();
} catch {
  /* no .env file */
}

const PORT = Number(process.env.PORT) || 4000;

function parseOrigins(raw) {
  const list = (raw || '*')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, '')) // browsers send Origin without a trailing slash
    .filter(Boolean);
  if (list.length === 0 || list.includes('*')) return '*';
  return list;
}

const origin = parseOrigins(process.env.CORS_ORIGIN);
const corsOptions = { origin, methods: ['GET', 'POST', 'OPTIONS'] };

function iceServers() {
  const servers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const turnUrls = (process.env.TURN_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (turnUrls.length) {
    const turn = { urls: turnUrls };
    if (process.env.TURN_USERNAME) turn.username = process.env.TURN_USERNAME;
    if (process.env.TURN_CREDENTIAL) turn.credential = process.env.TURN_CREDENTIAL;
    servers.push(turn);
  }
  return servers;
}

const app = express();
app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/ice', (_req, res) => res.json({ iceServers: iceServers() }));

app.post('/api/rooms', (_req, res) => {
  const room = createRoom();
  res.json({ roomId: room.id });
});

app.get('/api/rooms/:id', (req, res) => res.json(roomInfo(req.params.id)));

app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.status === 400 ? 'BAD_REQUEST' : 'INTERNAL' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
  maxHttpBufferSize: 1e6,
  pingInterval: 20000,
  pingTimeout: 20000,
});

registerSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`Streamly backend listening on http://localhost:${PORT}`);
  console.log(`CORS origin: ${Array.isArray(origin) ? origin.join(', ') : origin}`);
});

function shutdown() {
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
