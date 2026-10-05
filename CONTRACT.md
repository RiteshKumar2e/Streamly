# Streamly Watch Party — Shared Contract

Two people watch the same movie in real time. Movie in the center, each person's camera
tile on the left/right. Both people have full control: play/pause, seek (±10s, scrub),
playback speed. Volume and mute are local to each person (each person sets their own sound level).

- `backend/`  — Node 20+, Express + Socket.IO (ESM). Deployed separately (Render/Railway/any Node host).
- `frontend/` — React 18 + Vite + react-router-dom (JSX, plain CSS). Deployed on Vercel (Root Directory = `frontend`).

## Environment

backend:  `PORT` (default 4000), `CORS_ORIGIN` (comma-separated, default `*`),
          `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` (optional; comma-separated TURN_URL allowed)
frontend: `VITE_BACKEND_URL` (default `http://localhost:4000`) — read ONLY via `src/lib/api.js`.

## REST (backend)

| Method | Path              | Response |
|--------|-------------------|----------|
| GET    | `/health`         | `{ ok: true }` |
| GET    | `/api/ice`        | `{ iceServers: RTCIceServer[] }` (Google STUN + optional TURN from env) |
| POST   | `/api/rooms`      | `{ roomId }` — 6 chars, uppercase, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` |
| GET    | `/api/rooms/:id`  | `{ exists: bool, count: number, full: bool }` |

Room ids are case-insensitive (server uppercases). Joining a non-existent id via socket CREATES it
(so shared links always work). Max 2 participants per room. Empty rooms are deleted 10 minutes after the last person leaves.

## Socket.IO events

Client connects with `io(BACKEND_URL, { transports: ['websocket','polling'] })`.

### Client → Server

| Event | Payload | Ack |
|-------|---------|-----|
| `clock:ping` | none | `ack(serverNowMs)` |
| `room:join` | `{ roomId, name, clientId? }` (clientId: random per-tab id; a stale member with the same clientId is evicted on rejoin) | `ack({ ok:true, selfId, roomId, peers:[{id,name,cam,mic}], state:PlaybackState, messages:ChatMessage[] })` or `ack({ ok:false, error:'ROOM_FULL'|'BAD_REQUEST' })` |
| `room:leave` | none | — |
| `signal` | `{ to, data }` (data = `{ description }` or `{ candidate }`) | — server forwards `signal {from, data}` to `to` only if both in same room |
| `sync:action` | `SyncAction` (without from/serverTime) | — server updates room state, broadcasts to OTHER members |
| `sync:request` | none | `ack(PlaybackState)` |
| `chat:send` | `{ text }` (trimmed, max 500 chars) | — server broadcasts `chat:message` to ALL members incl. sender; keeps last 100 |
| `media:status` | `{ cam:bool, mic:bool }` | — broadcast `peer:media {id, cam, mic}` to others |

### Server → Client

| Event | Payload |
|-------|---------|
| `peer:joined` | `{ id, name, cam, mic }` |
| `peer:left` | `{ id }` |
| `signal` | `{ from, data }` |
| `sync:action` | `SyncAction` (with `from`, `name`, `serverTime`) |
| `chat:message` | `ChatMessage` |
| `peer:media` | `{ id, cam, mic }` |

### Types

```ts
type Source =
  | { kind: 'url',  url: string, title: string }          // direct video URL (mp4/webm/HLS-not-required)
  | { kind: 'file', name: string, size: number, title: string } // each person picks the same local file

type PlaybackState = {
  source: Source | null,
  playing: boolean,
  time: number,       // seconds, position at updatedAt
  rate: number,       // playback rate
  updatedAt: number,  // SERVER ms timestamp
}

type SyncAction =
  | { type: 'play',   time: number }
  | { type: 'pause',  time: number }
  | { type: 'seek',   time: number }
  | { type: 'rate',   rate: number, time: number }
  | { type: 'source', source: Source | null }   // resets time 0, paused, rate 1
  // server adds: from: socketId, name: string, serverTime: number (ms)

type ChatMessage = { id: string, from: string, name: string, text: string, ts: number }
```

Server state rule: on every action, `state.updatedAt = Date.now()`; play/pause/seek/rate set `time`;
play sets `playing=true`, pause `playing=false`. Expected position now =
`time + (playing ? (now - updatedAt)/1000 * rate : 0)`.

### WebRTC

- Newcomer (the one whose `room:join` ack has a non-empty `peers`) is the OFFERER to the existing peer.
- Use the "perfect negotiation" pattern: polite = the peer that was in the room first (i.e. NOT the newcomer).
- Local stream: `getUserMedia({ video: { width:640, height:360 }, audio: { echoCancellation:true, noiseSuppression:true } })`.
  If permission is denied, still connect (recvonly transceivers) so you can see the other person.
- Camera/mic toggles flip `track.enabled` and emit `media:status`.
