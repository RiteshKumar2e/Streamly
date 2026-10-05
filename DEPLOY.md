# Deploying Streamly

- **Backend** (`backend/`) → **Render** (Web Service). It must run all the time because Socket.IO needs a live server, so it can't go on Vercel.
- **Frontend** (`frontend/`) → **Vercel**.

Deploy the backend first: the frontend needs its URL.

---

## 1. Backend on Render

1. Go to [render.com](https://render.com) → **New +** → **Web Service** → connect the `RiteshKumar2e/Streamly` GitHub repo.
2. Fill in:

   | Setting                  | Value                           |
   | ------------------------ | ------------------------------- |
   | Name                     | `streamly-backend` (any name) |
   | Branch                   | `main`                        |
   | **Root Directory** | `backend`                     |
   | Runtime                  | `Node`                        |
   | Build Command            | `npm install`                 |
   | Start Command            | `npm start`                   |
   | Instance Type            | Free is fine to start           |
3. **Environment Variables** (Render → your service → *Environment*):

   | Key                 | Value                                                                     | Required?            |
   | ------------------- | ------------------------------------------------------------------------- | -------------------- |
   | `CORS_ORIGIN`     | Your Vercel URL, e.g.`https://streamly-psi-six.vercel.app`                      | Yes                  |
   | `NODE_VERSION`    | `22`                                                                    | Recommended          |
   | `NODE_ENV`        | `production` (turns on the HTTP → HTTPS redirect)                         | Recommended          |
   | `TURN_URL`        | e.g.`turn:global.relay.metered.ca:80,turns:global.relay.metered.ca:443` | Optional (see below) |
   | `TURN_USERNAME`   | from your TURN provider                                                   | Optional             |
   | `TURN_CREDENTIAL` | from your TURN provider                                                   | Optional             |


   - **Don't set `PORT`.** Render sets it automatically.
   - `CORS_ORIGIN` can hold several URLs separated by commas, e.g.
     `https://streamly-psi-six.vercel.app,http://localhost:5173`. A trailing `/` is fine.
   - Don't know the Vercel URL yet? Put `*` for now and change it after step 2.
4. Click **Create Web Service**. When it's live, copy the URL (e.g. `https://streamly-backend.onrender.com`).
5. Check it: open `https://<your-backend>.onrender.com/health`. It should show `{"ok":true}`.

> **Free plan note:** the free Render service sleeps after ~15 minutes with no traffic. The first visit
> after that takes ~30–60 seconds while it wakes up. A paid instance stays awake.

---

## 2. Frontend on Vercel

The repo-root `vercel.json` already tells Vercel to install and build inside `frontend/`, so the
project settings can stay on their defaults.

1. Vercel → your Streamly project → **Settings**:

   - **Root Directory:** `./` (leave as is)
   - **Framework Preset / Build Command / Output Directory:** leave on default (no overrides). `vercel.json` handles them.
2. **Settings → Environment Variables**:

   | Key                  | Value                                                                              | Environments                     |
   | -------------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
   | `VITE_BACKEND_URL` | Your Render URL, e.g.`https://streamly-backend.onrender.com` (no trailing `/`) | Production, Preview, Development |
   | `VITE_SITE_URL` | Your real site URL, e.g. `https://streamly-psi-six.vercel.app` (used for SEO, sitemap, social previews) | Production |
   | `VITE_CONTACT_EMAIL` | Optional: contact email shown in footer and legal pages | Production |
3. **Redeploy** (Deployments → ⋯ → Redeploy). Vite bakes `VITE_*` variables in at **build time**,
   so changing the variable has no effect until you redeploy.

---

## 3. Final check

1. Put the real Vercel URL in Render's `CORS_ORIGIN` (if you used `*` earlier). Render restarts by itself.
2. Open the Vercel site → **Create room** → open the invite link on another device or browser.
3. Allow camera and mic on both, load a YouTube link, and press play on one side. The other side should follow.

---

## TURN server (optional, but recommended)

Video calls connect directly between the two browsers. On some networks (mobile data, office or
college Wi-Fi, strict routers) a direct connection isn't possible. The movie still syncs, but the
**cameras won't connect**. A TURN server relays the video in those cases.

Free option: [metered.ca](https://www.metered.ca/stun-turn) → create a free app → copy the TURN URLs,
username and credential into the three `TURN_*` variables on Render.

---

## Environment variable summary

**Render (backend)**

```
CORS_ORIGIN=https://streamly-psi-six.vercel.app
NODE_VERSION=22
NODE_ENV=production
# optional
TURN_URL=turn:global.relay.metered.ca:80,turns:global.relay.metered.ca:443
TURN_USERNAME=xxxx
TURN_CREDENTIAL=xxxx
```

**Vercel (frontend)**

```
VITE_BACKEND_URL=https://streamly-backend.onrender.com
# your real domain: used for canonical URLs, the sitemap and social previews
VITE_SITE_URL=https://streamly-psi-six.vercel.app
# optional: contact email shown in the footer and legal pages
VITE_CONTACT_EMAIL=you@example.com
```

**Local development** (`backend/.env` and `frontend/.env`, both git-ignored)

```
# backend/.env
PORT=4000
CORS_ORIGIN=*

# frontend/.env
VITE_BACKEND_URL=http://localhost:4000
```

---

## Troubleshooting

| Problem                                     | Fix                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Render: `npm: command not found` | Node was unpinned, so Render picked a build without npm. `backend/package.json` now pins `22.x` (plus `backend/.node-version`). Push it, or set `NODE_VERSION=22` on Render. |
| Vercel:`vite: command not found`          | Make sure the repo-root`vercel.json` is pushed and Vercel's Build/Install/Output overrides are off. |
| Site loads but stuck on "Connecting…"      | `VITE_BACKEND_URL` is missing or wrong on Vercel, or you didn't redeploy after setting it.          |
| Browser console shows a CORS error          | Render's`CORS_ORIGIN` doesn't match your Vercel URL exactly (`https://`, no path).                |
| First load is very slow                     | Free Render instance is waking up. Wait ~1 minute.                                                    |
| Movie syncs but cameras don't connect       | Add a TURN server (see above).                                                                        |
| YouTube video says "owner doesn't allow it" | That video blocks embedding. Try another video.                                                       |
