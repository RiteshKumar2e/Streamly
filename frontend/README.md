# Streamly — Frontend

React 18 + Vite single-page app for Streamly, the two-person watch party.
The movie plays in the center with each person's camera on either side; playback
(play / pause / seek / speed) is synced through the backend, while volume stays local.

## Requirements

- Node.js 20+
- A running Streamly backend (see `../backend`)

## Local development

```bash
cd frontend
cp .env.example .env      # adjust VITE_BACKEND_URL if needed
npm install
npm run dev               # http://localhost:5173
```

Other scripts:

| Script            | What it does                         |
|-------------------|--------------------------------------|
| `npm run dev`     | Vite dev server with HMR             |
| `npm run build`   | Production build into `dist/`        |
| `npm run preview` | Serve the production build locally   |

## Environment variables

| Variable           | Default                 | Description                          |
|--------------------|-------------------------|--------------------------------------|
| `VITE_BACKEND_URL` | `http://localhost:4000` | Base URL of the Express + Socket.IO backend (no trailing slash). |

The value is read only in `src/lib/api.js`. Vite inlines `VITE_*` variables at build time,
so redeploy after changing it.

## Routes

| Path            | Page                                  |
|-----------------|---------------------------------------|
| `/`             | Landing page — create or join a room  |
| `/join?code=`   | Join form (code + name)               |
| `/room/:roomId` | The watch-party room                  |
| `*`             | 404                                   |

The display name is remembered in `localStorage` under `streamly:name`.

## Project structure

```
src/
  main.jsx, App.jsx        entry + routes
  lib/api.js               REST helpers + BACKEND_URL
  styles/tokens.css        design tokens (CSS variables)
  styles/global.css        reset + shared utility classes (.btn, .input, .card, ...)
  components/ui/           Navbar, Footer, Logo
  components/room/         room UI (player, camera tiles, chat, controls)
  pages/                   Home, Join, Room, NotFound
```

## Deploying to Vercel

1. Import the repository in Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Vite** (build command `npm run build`, output directory `dist`).
4. Add the environment variable `VITE_BACKEND_URL` pointing to your deployed backend,
   e.g. `https://streamly-backend.onrender.com`.
5. Deploy. `vercel.json` rewrites every route to `index.html` so deep links like
   `/room/ABC123` work.

Make sure the backend's `CORS_ORIGIN` includes your Vercel domain.
