# Streamly

> **Your phone. Your movie. Your big screen.**

Streamly lets you select a movie or video file stored directly on your phone and transfer it peer-to-peer to your laptop over a local browser-to-browser connection. Your phone acts as the video source and TV-style remote control, while your laptop transforms into a cinematic big-screen video player.

---

## 1. What Streamly Is

Streamly is a React/Vite web application with a tiny WebSocket signaling relay. The relay only helps the phone and laptop exchange WebRTC connection metadata; the selected movie and remote-control messages travel directly peer-to-peer and are never uploaded to the relay.

* **Privacy-First**: The movie remains on your phone. It is never uploaded to any cloud storage or server.
* **Direct Control**: Play, pause, seek, adjust volume, and toggle mute directly from your phone screen.
* **Cinematic Experience**: Custom dark-themed video player on the laptop with keyboard shortcuts (`Space`, `←`, `→`, `F`, `M`).

---

## 2. Architecture

Streamly follows a decoupled, browser-native client architecture:

```text
Phone (Controller & Media Source)                      Laptop (Player & Big Screen)
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│  - File API (Memory File chunk) │                 │  - VideoPlayer (HTML5 <video>)  │
│  - RemoteControls (Touch UI)    │                 │  - Keyboard shortcuts listener  │
│  - WebRTC Offerer               │                 │  - WebRTC Answerer              │
└──────────────┬──────────────────┘                 └────────────────┬────────────────┘
               │                                                     │
               │         WebRTC RTCDataChannel ("control")           │
               ├────────────────────────────────────────────────────►│
               │   JSON Control Messages ({type: 'play' | 'seek'})   │
               │◄────────────────────────────────────────────────────┤
               │   JSON Playback State   ({type: 'state', currentTime})
               │                                                     │
               │         WebRTC RTCDataChannel ("transfer")          │
               ├────────────────────────────────────────────────────►│
               │   Chunked ArrayBuffers (64 KB chunks + Backpressure)│
               │   Assembled into Blob URL -> <video src="...">      │
```

### Directory Structure

```text
Streamly/
├── public/
│   └── streamly.svg             # Application logo & favicon
├── src/
│   ├── components/
│   │   ├── Navbar.jsx           # Top header with dynamic status dot
│   │   ├── DeviceSelector.jsx   # Role picker on landing page
│   │   ├── PairingCode.jsx      # High-legibility 6-digit display
│   │   ├── QRCode.jsx           # QR code for pairing link
│   │   ├── FilePicker.jsx       # Native <input type="file" accept="video/*">
│   │   ├── ConnectionStatus.jsx # Real-time connection badge
│   │   ├── VideoPlayer.jsx      # Cinematic HTML5 video player with shortcuts
│   │   ├── RemoteControls.jsx   # Touch-optimized TV remote controls
│   │   ├── ProgressBar.jsx      # Chunk transfer progress and byte counter
│   │   └── ErrorMessage.jsx     # Dismissible user error feedback
│   │
│   ├── hooks/
│   │   ├── useWebRTC.js         # PeerConnection lifecycle & state management
│   │   ├── usePairing.js        # Pairing code generation & input formatting
│   │   └── useVideoTransfer.js  # File slicing, streaming & Blob assembly
│   │
│   ├── services/
│   │   ├── webrtc.js            # Standardized RTCPeerConnection & DataChannels
│   │   ├── transfer.js          # Slicing, backpressure & ArrayBuffer assembly
│   │   └── signaling.js         # WebSocket relay client & SDP utilities
│   │
│   ├── pages/
│   │   ├── Home.jsx             # Hero landing page & how-it-works guide
│   │   ├── Phone.jsx            # Phone mode (source + remote)
│   │   └── Laptop.jsx           # Laptop mode (receiver + player)
│   │
│   ├── App.jsx                  # Main router config
│   ├── main.jsx                 # Entry point
│   └── index.css                # Premium dark design system & animations
├── index.html                   # HTML5 shell with Inter typography
├── vite.config.js               # Vite config (host 0.0.0.0 for LAN access)
└── package.json
```

---

## 3. Browser APIs Used

* **WebRTC API (`RTCPeerConnection`, `RTCDataChannel`)**: Establishes peer-to-peer data channels for control messages (`control`) and binary video streaming (`transfer`).
* **File & Blob API (`File`, `Blob`, `FileReader`, `URL.createObjectURL()`)**: Slices video files on demand without reading the entire file into JavaScript memory.
* **WebSocket**: Relays short-lived pairing, SDP, and ICE metadata so separate phone and laptop browsers can discover each other.
* **Fullscreen API**: Powers one-click immersion on the laptop player.
* **Clipboard API (`navigator.clipboard`)**: Supports optional copying of pairing details.

---

## 4. How Local File Access Works

Modern web browsers enforce strict security sandboxes:
* Websites **cannot** arbitrarily traverse or read the file system without explicit user interaction.
* When the user taps **"Choose your movie"**, Streamly activates an `<input type="file" accept="video/*">` element.
* The operating system presents its native file chooser (e.g., Files on Android or Explorer on Windows).
* Once selected, browser memory receives a read-only `File` reference.
* Rather than loading multi-gigabyte video files into RAM or encoding them as Base64 strings, Streamly uses `file.slice(offset, end)` to read only 64 KB slices at a time via `FileReader.readAsArrayBuffer()`.

---

## 5. How WebRTC Works & Backpressure Management

1. **Channels**: Streamly allocates two distinct `RTCDataChannel`s:
   * `control`: Reliable, in-order channel for lightweight JSON commands (`play`, `pause`, `seek`, `volume`, `state`).
   * `transfer`: High-throughput binary channel for file chunks.
2. **Backpressure**:
   When transmitting gigabyte video files over WebRTC, the network or socket buffer can saturate. Streamly monitors `channel.bufferedAmount`. If the buffer exceeds 1 MB (`MAX_BUFFERED_AMOUNT`), streaming halts until the browser fires `bufferedamountlow` (threshold set to 256 KB), preventing browser crashes or high memory spikes.

---

## 6. Why Signaling is Normally Required

WebRTC peers cannot discover each other out of thin air. Before two devices can communicate directly, they must exchange:
1. **SDP Offer / Answer**: Session descriptions outlining supported codecs, protocols, and data channel options.
2. **ICE Candidates**: IP addresses and port combinations (local LAN IPs and public STUN reflections).

In standard commercial applications, a lightweight **Signaling Server** (using WebSockets or HTTP SSE) relays these handshake messages.

---

## 7. Automatic QR pairing

The laptop creates a short-lived six-digit room and displays a QR code containing the phone route. The phone scans that QR code with the Android camera and opens Streamly with the room code. Both browsers connect to the WebSocket relay, exchange the WebRTC offer/answer, and then disconnect from signaling. The relay never sees the selected file.

The QR code is a convenient way to carry the room identifier; it does not contain the movie or the WebRTC session itself. A pairing room accepts one phone and one laptop and is removed when both clients disconnect.

---

## 8. Browser Limitations & Formats

* **Container & Codec Compatibility**: HTML5 `<video>` supports video formats supported natively by the receiving browser (MP4 with H.264/AAC, WebM with VP8/VP9). Non-standard formats (such as raw AVI or MKV with unsupported audio tracks) depend on browser decoding capabilities.
* **Playback buffering**: The current browser-only implementation sends the file in ordered chunks, then creates a Blob URL on the laptop. It does not Base64-encode the file and does not store it in React state, but the completed Blob still requires significant laptop memory before playback starts.
* **Large files**: Transfers are rejected above 8 GB and very large files can fail if the browser cannot allocate a Blob. This is an honest limitation of playing an arbitrary, non-fragmented local movie without a server or persistent browser file sink. A future MediaSource implementation can improve this for compatible fragmented media, but cannot safely support every phone video container.
* **Connection security**: WebRTC uses public STUN servers only for ICE discovery. Media and control data are peer-to-peer after connection; signaling text contains session metadata, not the movie.

---

## 9. How to Run

### Prerequisites
* Node.js (v18+ recommended)
* npm

### Installation & Launch

```bash
# 1. Install dependencies
npm install

# 2. Start Vite and the WebSocket signaling relay
npm run dev
```

The server starts at `http://0.0.0.0:5173`. Vite will print your local network address, for example:
```text
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.15:5173/
```

---

## 10. How to Test

### Scenario A: Local test (same machine)
1. Run `npm run dev`.
2. Open the laptop using the LAN URL Vite prints, for example `http://192.168.1.15:5173/laptop`. Do not use `localhost` for the QR flow because the phone would resolve `localhost` to itself.
3. Open the QR target (`http://localhost:5173/phone?code=...`) in another browser tab, or enter the displayed room code on `/phone`.
4. Select a video on the phone view and tap **Start Watching**.

### Scenario B: Real Cross-Device Test (Android Phone & Windows Laptop)
1. Ensure both your Phone and Laptop are connected to the **same Wi-Fi network**.
2. Run `npm run dev` on your laptop. Note the `Network` IP (e.g. `http://192.168.1.15:5173`).
3. On your **Laptop**, open the LAN URL, for example `http://192.168.1.15:5173/laptop`.
4. On your **Android Phone**, scan the QR code shown on the laptop using the phone camera.
5. Choose **Open in Chrome** when Android offers the link. Streamly will join the room automatically.
6. Select your movie on Android and tap **Start Watching**. Wait for the transfer to finish; the laptop then creates a local Blob URL and begins playback.
7. Use the phone as the remote. If the connection is interrupted, refresh both pages and scan a newly generated QR code.

### Deployment (Vercel)

No separate server is needed. Pairing messages (offer/answer/ICE) go through
ntfy.sh topics: the browser connects directly over SSE, with `/api/signal` as a fallback.

### Phone hotspot mode (laptop on the phone's hotspot, phone on mobile data)

In this setup the two devices can't reach each other directly over WebRTC.
Android Chrome only uses the mobile-data network for WebRTC, and the carrier's
NAT doesn't loop traffic back to the phone. The connection needs a **TURN relay**.
`/api/ice` hands TURN credentials to the browser. Set ONE of these in Vercel
→ Settings → Environment Variables, then redeploy:

| Provider | Variables |
| --- | --- |
| Cloudflare TURN (free 1 TB/month): dash.cloudflare.com → Calls/Realtime → TURN | `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` |
| Metered (free 20 GB/month): metered.ca → TURN | `METERED_DOMAIN` (e.g. `myapp.metered.live`), `METERED_API_KEY` |
| Any TURN server | `TURN_URL` (comma separated), `TURN_USERNAME`, `TURN_CREDENTIAL` |

If none is set, a free public relay is used on a best-effort basis. When the
devices are on the same Wi-Fi, WebRTC still connects directly and the relay isn't used.
Relayed video goes over mobile data, so large movies use data and transfer at your 4G upload speed.
