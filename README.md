# Streamly

> **Your phone. Your movie. Your big screen.**

Streamly allows you to select a movie or video file stored directly on your phone and stream it seamlessly to your laptop over a local browser-to-browser connection. Your phone acts as the video source and TV-style remote control, while your laptop transforms into a cinematic big-screen video player.

---

## 1. What Streamly Is

Streamly is a client-only web application built with React, Vite, and native Web APIs. It enables peer-to-peer media streaming and playback synchronization between mobile devices and personal computers without routing video data through external servers, cloud databases, or third-party hosting providers.

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
│   │   └── signaling.js         # BroadcastChannel & SDP encode/decode utilities
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
* **BroadcastChannel API**: Enables zero-configuration signaling when testing phone and laptop views across tabs within the same browser instance.
* **Fullscreen API**: Powers one-click immersion on the laptop player.
* **Clipboard API (`navigator.clipboard`)**: Provides single-tap copying of serverless SDP exchange tokens.

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

## 7. What is Possible With a React-Only / Browser-Only Architecture

Because this project adheres to a strict **zero-backend, zero-database constraint**:

1. **Same Browser / Testing Mode**: Streamly utilizes the `BroadcastChannel` API. If you open `http://localhost:5173/phone` and `http://localhost:5173/laptop` in two windows, they detect each other and pair automatically via the pairing code without any manual steps.
2. **Cross-Device Mode (Phone to Laptop)**: Since independent browser instances on different devices cannot directly discover each other without an external signaling bridge, Streamly provides an honest, built-in **Direct Signaling Modal**:
   * Phone creates an Offer → Click **Copy Offer**
   * Paste into Laptop → Click **Generate Answer**
   * Paste Answer back into Phone → Click **Complete Connection**
   * The direct WebRTC peer connection is established, and all subsequent video streaming and remote commands run peer-to-peer over your local Wi-Fi.

> **Extensibility**: The signaling logic in `src/services/signaling.js` is isolated into a modular class. When deploying to production with a WebSocket server, you only need to add a WebSocket adapter without touching the WebRTC or UI layers.

---

## 8. Browser Limitations & Formats

* **Container & Codec Compatibility**: HTML5 `<video>` supports video formats supported natively by the receiving browser (MP4 with H.264/AAC, WebM with VP8/VP9). Non-standard formats (such as raw AVI or MKV with unsupported audio tracks) depend on browser decoding capabilities.
* **Memory Limits**: The browser limits total Blob sizes in memory. For extremely large videos (e.g. 4K files > 4 GB), Chrome/Edge 64-bit performs best.

---

## 9. How to Run

### Prerequisites
* Node.js (v18+ recommended)
* npm

### Installation & Launch

```bash
# 1. Install dependencies
npm install

# 2. Start the Vite development server on all network interfaces
npm run dev
```

The server starts at `http://0.0.0.0:5173`. Vite will print your local network address, for example:
```text
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.15:5173/
```

---

## 10. How to Test

### Scenario A: Instant Local Test (Same Machine, Two Tabs)
1. Open `http://localhost:5173/phone` in Tab 1.
2. Note the 6-digit code (e.g., `482 731`).
3. Open `http://localhost:5173/laptop` in Tab 2.
4. Enter `482 731` and tap **Connect Phone**.
5. The `BroadcastChannel` establishes the connection automatically.
6. On Tab 1, pick a video file and click **Start Watching**.
7. Watch Tab 2 receive the video and use Tab 1 as your TV remote.

### Scenario B: Real Cross-Device Test (Android Phone & Windows Laptop)
1. Ensure both your Phone and Laptop are connected to the **same Wi-Fi network**.
2. Run `npm run dev` on your laptop. Note the `Network` IP (e.g. `http://192.168.1.15:5173`).
3. On your **Laptop**, open `http://localhost:5173/laptop`.
4. On your **Android Phone**, open `http://192.168.1.15:5173/phone` in Chrome.
5. In Phone mode, tap **⚙️ Direct Signaling (Cross-Device)** and copy the Offer.
6. On Laptop, click **⚙️ Direct Signaling (Cross-Device)**, paste the Offer, and copy the generated Answer.
7. Paste the Answer into the Phone modal and click **Complete Connection**.
8. Select your movie on Android and enjoy big-screen streaming with synchronized remote controls!
