# Streamly

Two-person, real-time movie watch party. Both people watch the same movie in sync with
their cameras on: the movie sits in the center, one person's camera on the left and the
other's on the right. Either person can play, pause, seek or change speed; volume is
personal to each viewer. Video calls are peer-to-peer (WebRTC).

## Repository layout

```
backend/    Node 20+ · Express + Socket.IO — rooms, playback sync, chat, WebRTC signaling
frontend/   React 18 + Vite SPA — landing page, join flow, watch-party room
CONTRACT.md REST + Socket.IO contract shared by both apps
```

See `backend/README.md` and `frontend/README.md` for details.

## Local development

Run the two apps in separate terminals:

```bash
# terminal 1 — API + sockets on http://localhost:4000
cd backend && npm install && npm run dev

# terminal 2 — web app on http://localhost:5173
cd frontend && npm install && npm run dev
```

The frontend reads `VITE_BACKEND_URL` (default `http://localhost:4000`); copy
`frontend/.env.example` to `frontend/.env` to change it.

## Deployment

- **Backend** — any Node host that supports WebSockets (Render, Railway, Fly.io, a VPS).
  Set `PORT`, `CORS_ORIGIN` (your frontend origin) and optionally
  `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` for reliable calls behind strict NATs.
- **Frontend** — Vercel with **Root Directory = `frontend`**, framework preset Vite, and
  `VITE_BACKEND_URL` set to the deployed backend URL.
