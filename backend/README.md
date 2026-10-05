# Streamly Backend

Express + Socket.IO server for Streamly, a two-person watch party. It handles room
management, playback sync, chat, and WebRTC signaling. The protocol is defined in
[`../CONTRACT.md`](../CONTRACT.md).

All state lives in memory. Restarting the server clears every room.

## Requirements

Node.js 18 or newer (20+ recommended).

## Environment variables

| Variable          | Default | Description |
|-------------------|---------|-------------|
| `PORT`            | `4000`  | HTTP port. |
| `CORS_ORIGIN`     | `*`     | Comma-separated list of allowed origins (e.g. `https://streamly-psi-six.vercel.app`). Applies to REST and Socket.IO. |
| `TURN_URL`        | –       | Optional TURN server URL(s), comma-separated (e.g. `turn:turn.example.com:3478`). |
| `TURN_USERNAME`   | –       | TURN username. |
| `TURN_CREDENTIAL` | –       | TURN password/credential. |

See `.env.example`. Copy it to `backend/.env` for local dev; it is loaded automatically
(Node 20.12+) and is git-ignored. Real environment variables (shell or hosting dashboard) take priority.

## Run locally

```bash
npm install
npm start          # or: npm run dev  (auto-restart on changes)
```

The server logs `Streamly backend listening on http://localhost:4000`.

## REST endpoints

| Method | Path             | Response |
|--------|------------------|----------|
| GET    | `/health`        | `{ ok: true }` |
| GET    | `/api/ice`       | `{ iceServers: [...] }` (Google STUN plus TURN if configured) |
| POST   | `/api/rooms`     | `{ roomId }` (6-character code) |
| GET    | `/api/rooms/:id` | `{ exists, count, full }` |

Rooms hold at most 2 people. Joining an unknown room id over the socket creates it.
Empty rooms are deleted 10 minutes after the last person leaves.

## Security & limits

All limits are in memory (`src/rateLimit.js`, token buckets with periodic cleanup), per server instance.

- `trust proxy` is set to 1 hop, so `req.ip` and `req.secure` reflect the real client behind Render's proxy.
  Socket IPs come from the first `X-Forwarded-For` entry, falling back to the peer address.
- REST: `POST /api/rooms` 10/min per IP, `GET /api/rooms/:id` 60/min per IP. Over the limit:
  `429 { "error": "RATE_LIMITED" }` with a `Retry-After` header (seconds).
- Socket.IO: at most 20 concurrent connections per IP (extra connections fail with `connect_error` `RATE_LIMITED`).
- Per socket: `room:join` 10/min (ack `{ ok:false, error:'RATE_LIMITED' }`), `chat:send` 5 per 5s
  (sender gets `chat:rejected { reason:'RATE_LIMITED' }`; an identical repeat of the previous message within 3s is
  dropped silently), `sync:action` 20/s, `signal` 200 per 10s, `media:status` 20 per 10s, `clock:ping` 30 per 10s.
  Other excess events are dropped silently.
- Control characters (and bidi override characters) are stripped from chat text and names; emoji and other unicode are kept.
- Headers on every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`,
  and `Strict-Transport-Security: max-age=31536000; includeSubDomains` on HTTPS requests.
- With `NODE_ENV=production`, plain-HTTP requests (`X-Forwarded-Proto: http`) get a 308 redirect to HTTPS,
  except `/health` so health checks keep working.

## Deploy (Render / Railway)

1. Create a new Web Service from this repository with root directory `backend`.
2. Build command: `npm install`
3. Start command: `npm start`
4. Set `CORS_ORIGIN` to your frontend URL (e.g. `https://streamly-psi-six.vercel.app`) and,
   if you want, the TURN variables.
5. The platform supplies `PORT` automatically. Set `NODE_ENV=production` to enable the HTTPS redirect.

Set the frontend's `VITE_BACKEND_URL` to the deployed backend URL.

Because rooms are in memory, run a single instance. Horizontal scaling would need
a shared store and the Socket.IO Redis adapter.
