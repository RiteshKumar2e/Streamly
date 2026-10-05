<div align="center">

# Streamly

**Watch movies together, in sync, face to face.**

A two-person, real-time watch party with synchronized playback and a built-in peer-to-peer video call.

[**Live Demo**](https://streamly-psi-six.vercel.app)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P-333333?logo=webrtc&logoColor=white)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Security](#security)

## Overview

Streamly lets two people watch the same movie at the same time, wherever they are. The movie
plays in the center of the screen with each person's camera on either side. Either viewer can
play, pause, seek or change the playback speed, and the change is mirrored instantly for the
other. Volume stays personal to each viewer.

No account or sign-up is needed: create a room, share the code, and start watching.

## Features

| | |
|---|---|
| **Private rooms** | Create a room and share its 6-character code or invite link. Each room holds two people. |
| **Flexible sources** | Paste a YouTube link or a direct MP4/WebM URL, or have both viewers select the same file from their computers. |
| **Privacy-first local playback** | Local files are never uploaded. Only the file name and size are shared, so the other viewer can pick the matching file. |
| **Synchronized playback** | Play, pause, seek and speed changes are mirrored in real time, with clock synchronization to keep both players aligned. |
| **Peer-to-peer video call** | Camera and microphone run directly between the two browsers over WebRTC, with mute and camera controls and live connection status. |
| **Reliable connectivity** | TURN relay support (Cloudflare Realtime or any static TURN server) for mobile data and restrictive networks. |
| **In-room chat** | Text chat alongside the movie and video call. |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router |
| Backend | Node.js 22, Express 4, Socket.IO 4 |
| Real-time media | WebRTC (STUN + TURN) |
| Hosting | Vercel (frontend), Render (backend) |

## Architecture

```
┌──────────────┐        REST + Socket.IO         ┌──────────────────┐
│  Browser A   │ ◄─────────────────────────────► │                  │
│  (React SPA) │                                 │  Streamly API    │
└──────┬───────┘                                 │  Express +       │
       │                                         │  Socket.IO       │
       │  WebRTC (camera + mic, peer-to-peer)    │                  │
       │                                         │  · rooms         │
┌──────┴───────┐        REST + Socket.IO         │  · playback sync │
│  Browser B   │ ◄─────────────────────────────► │  · chat          │
│  (React SPA) │                                 │  · signaling     │
└──────────────┘                                 │  · ICE servers   │
                                                 └──────────────────┘
```

- **Backend** manages rooms, relays playback actions and chat, carries WebRTC signaling, and
  issues ICE server configuration (including short-lived TURN credentials).
- **Video and audio** flow directly between the two browsers; they never pass through the server.
- **All state is held in memory.** Empty rooms are cleaned up 10 minutes after the last person leaves.

## Project Structure

```
Streamly/
├── backend/          Express + Socket.IO server
│   ├── src/          index, socket handlers, rooms, rate limiting, ICE servers
│   ├── scripts/      Render build script
│   └── render.yaml   Render Blueprint
├── frontend/         React + Vite single-page app
│   └── src/          pages, room components, hooks, lib helpers, styles
└── vercel.json       Vercel build config, security headers and SPA rewrites
```

Detailed documentation for each app:
- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)

## Getting Started

### Prerequisites

- Node.js 22
- npm

### Installation

```bash
git clone <repository-url>
cd Streamly
```

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 — API and sockets on http://localhost:4000
cd backend
cp .env.example .env
npm install
npm run dev
```

```bash
# Terminal 2 — web app on http://localhost:5173
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 in two browser windows to try a room locally.

> **Note:** Browsers allow camera and microphone access only on `localhost` or over HTTPS.

## Configuration

### Backend

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port. Set automatically by most hosting platforms. |
| `CORS_ORIGIN` | `*` | Allowed frontend origins, comma-separated. |
| `CF_TURN_KEY_ID` | – | Cloudflare Realtime TURN key ID (recommended, free tier). |
| `CF_TURN_API_TOKEN` | – | Cloudflare Realtime TURN API token. |
| `TURN_URL` | – | Static TURN server URL(s), comma-separated (e.g. metered.ca). |
| `TURN_USERNAME` | – | Static TURN username. |
| `TURN_CREDENTIAL` | – | Static TURN credential. |
| `NODE_ENV` | – | Set to `production` to enable HTTP → HTTPS redirects. |

ICE servers are resolved in this order: Cloudflare TURN, then static TURN, with Google STUN
always included. Without a TURN relay, calls may fail on mobile data or behind strict routers.

### Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:4000` | Backend base URL, without a trailing slash. |
| `VITE_SITE_URL` | – | Public site URL for canonical links, sitemap and social previews. |
| `VITE_CONTACT_EMAIL` | – | Contact email shown in the footer and legal pages. |

`VITE_*` variables are embedded at build time; redeploy the frontend after changing them.

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check. |
| `GET` | `/api/ice` | ICE server list for WebRTC. |
| `POST` | `/api/rooms` | Create a room. Returns `{ roomId }`. |
| `GET` | `/api/rooms/:id` | Room status: `{ exists, count, full }`. |

Real-time events (room membership, playback sync, chat, signaling, media status and clock sync)
are handled over Socket.IO. See [backend/README.md](backend/README.md) for event limits.

## Deployment

### Backend — Render

1. In Render, choose **New + → Blueprint** and select this repository.
2. Set the Blueprint path to `backend/render.yaml`.
3. Provide the TURN variables when prompted.

Any Node.js host with WebSocket support (Railway, Fly.io, a VPS) works as well. Because rooms
are stored in memory, run a **single instance**.

### Frontend — Vercel

1. Import the repository, keeping the root directory at the repository root.
2. Set `VITE_BACKEND_URL` to the deployed backend URL.

[vercel.json](vercel.json) installs and builds `frontend/`, serves `frontend/dist`, and applies
security headers and SPA rewrites.

## Security

- Rate limiting on REST endpoints, socket connections and every socket event.
- Chat messages and display names are sanitized (control and bidi override characters removed).
- Strict security headers on both apps (HSTS, `nosniff`, frame denial, referrer policy,
  restricted permissions policy).
- HTTPS enforced in production.
- Media is peer-to-peer and local movie files never leave the viewer's device.
