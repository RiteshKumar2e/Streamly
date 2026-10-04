/**
 * Streamly — WebRTC Service
 *
 * Handles peer connection lifecycle, data channels, and ICE candidate management.
 * Designed to work with manual signaling (copy-paste SDP) since there is no backend.
 *
 * Architecture:
 *   Phone (offerer) creates an RTCPeerConnection and generates an SDP offer.
 *   Laptop (answerer) receives the offer, generates an SDP answer.
 *   Both exchange ICE candidates bundled into the SDP via "ICE trickling" disabled (ice gathering complete).
 *
 * Two data channels:
 *   1. "control" — JSON messages for play/pause/seek/volume commands
 *   2. "transfer" — Binary chunks for video file transfer
 */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const DATA_CHANNEL_OPTIONS = {
  ordered: true,
};

const TRANSFER_CHANNEL_OPTIONS = {
  ordered: true,
  maxRetransmits: 3,
};

/**
 * Create a new RTCPeerConnection with standardized config.
 */
export function createPeerConnection() {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 2,
  });
  return pc;
}

/**
 * Wait until ICE gathering is complete, then return the local description
 * with all candidates bundled in.
 */
export function waitForIceGatheringComplete(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve(pc.localDescription);
      return;
    }

    const checkState = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve(pc.localDescription);
      }
    };

    pc.addEventListener('icegatheringstatechange', checkState);

    // Fallback timeout — some browsers stall on ICE gathering
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', checkState);
      resolve(pc.localDescription);
    }, 10000);
  });
}

/**
 * Phone side: Create offer and data channels.
 * Returns { pc, controlChannel, transferChannel, offer }
 */
export async function createOffer() {
  const pc = createPeerConnection();

  // Create data channels (only the offerer creates them)
  const controlChannel = pc.createDataChannel('control', DATA_CHANNEL_OPTIONS);
  const transferChannel = pc.createDataChannel('transfer', TRANSFER_CHANNEL_OPTIONS);

  // Set bufferedAmountLowThreshold for backpressure
  transferChannel.bufferedAmountLowThreshold = 256 * 1024; // 256KB

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Wait for ICE candidates to be gathered
  const completeOffer = await waitForIceGatheringComplete(pc);

  return {
    pc,
    controlChannel,
    transferChannel,
    offer: completeOffer,
  };
}

/**
 * Laptop side: Accept an offer and create an answer.
 * Returns { pc, answer }
 * The laptop will receive data channels via pc.ondatachannel events.
 */
export async function createAnswer(offerSdp) {
  const pc = createPeerConnection();

  const offer = new RTCSessionDescription({
    type: 'offer',
    sdp: offerSdp,
  });

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  const completeAnswer = await waitForIceGatheringComplete(pc);

  return {
    pc,
    answer: completeAnswer,
  };
}

/**
 * Phone side: Accept the answer from the laptop.
 */
export async function acceptAnswer(pc, answerSdp) {
  const answer = new RTCSessionDescription({
    type: 'answer',
    sdp: answerSdp,
  });
  await pc.setRemoteDescription(answer);
}

/**
 * Set up event listeners on a peer connection.
 */
export function setupConnectionListeners(pc, callbacks = {}) {
  const {
    onConnectionStateChange,
    onIceConnectionStateChange,
    onDataChannel,
    onIceCandidate,
  } = callbacks;

  if (onConnectionStateChange) {
    pc.addEventListener('connectionstatechange', () => {
      onConnectionStateChange(pc.connectionState);
    });
  }

  if (onIceConnectionStateChange) {
    pc.addEventListener('iceconnectionstatechange', () => {
      onIceConnectionStateChange(pc.iceConnectionState);
    });
  }

  if (onDataChannel) {
    pc.addEventListener('datachannel', (event) => {
      onDataChannel(event.channel);
    });
  }

  if (onIceCandidate) {
    pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    });
  }
}

/**
 * Clean up a peer connection and its data channels.
 */
export function cleanupConnection(pc, channels = []) {
  channels.forEach((ch) => {
    try {
      if (ch && ch.readyState !== 'closed') {
        ch.close();
      }
    } catch (e) {
      // Ignore
    }
  });

  try {
    if (pc && pc.connectionState !== 'closed') {
      pc.close();
    }
  } catch (e) {
    // Ignore
  }
}

/**
 * Send a JSON message over a data channel.
 */
export function sendControlMessage(channel, message) {
  if (channel && channel.readyState === 'open') {
    channel.send(JSON.stringify(message));
    return true;
  }
  return false;
}

/**
 * Validate an incoming control message.
 * Returns the parsed message or null if invalid.
 */
export function parseControlMessage(data) {
  try {
    const msg = JSON.parse(data);
    const validTypes = ['play', 'pause', 'seek', 'volume', 'mute', 'state', 'file-info', 'file-ready', 'request-file', 'transfer-complete', 'error'];
    if (msg && validTypes.includes(msg.type)) {
      return msg;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check browser WebRTC support.
 */
export function checkWebRTCSupport() {
  const supported = {
    rtcPeerConnection: !!window.RTCPeerConnection,
    rtcDataChannel: !!window.RTCPeerConnection?.prototype?.createDataChannel,
    mediaSource: !!window.MediaSource,
    fileApi: !!window.File && !!window.FileReader && !!window.FileList && !!window.Blob,
  };

  supported.all = Object.values(supported).every(Boolean);

  return supported;
}
