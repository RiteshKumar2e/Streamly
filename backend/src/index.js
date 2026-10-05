// Streamly backend: Express REST + Socket.IO signaling/sync server.
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createRoom, roomInfo } from './rooms.js';
import { registerSocketHandlers } from './socket.js';
import { rateLimitMiddleware } from './rateLimit.js';
import { getIceServers, turnConfigured } from './ice.js';

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


const app = express();
app.disable('x-powered-by');
// Render (and most PaaS) terminate TLS at a single proxy hop: trust it so req.ip / req.secure
// reflect the real client.
app.set('trust proxy', 1);

const IS_PROD = process.env.NODE_ENV === 'production';

// HTTPS enforcement + security headers.
app.use((req, res, next) => {
  if (IS_PROD && req.headers['x-forwarded-proto'] === 'http' && req.path !== '/health') {
    const host = req.headers.host;
    if (host && /^[A-Za-z0-9.-]+(:\d+)?$/.test(host)) return res.redirect(308, `https://${host}${req.originalUrl}`);
  }
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Frame-Options', 'DENY');
  next();
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/ice', async (_req, res) => {
  res.set('Cache-Control', 'no-store'); // contains short-lived TURN credentials
  res.json({ iceServers: await getIceServers() });
});

const createRoomLimit = rateLimitMiddleware({ limit: 10, windowMs: 60_000 });
const roomInfoLimit = rateLimitMiddleware({ limit: 60, windowMs: 60_000 });

app.post('/api/rooms', createRoomLimit, (_req, res) => {
  const room = createRoom();
  res.json({ roomId: room.id });
});

app.get('/api/rooms/:id', roomInfoLimit, (req, res) => res.json(roomInfo(req.params.id)));

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
  if (!turnConfigured()) console.warn('No TURN server configured: video calls may not connect across different networks. See DEPLOY.md.');
});

function shutdown() {
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
