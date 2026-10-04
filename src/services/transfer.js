/**
 * Streamly — Video Transfer Service
 *
 * Handles chunked video file transfer over WebRTC DataChannel.
 *
 * Strategy:
 *   1. Phone reads the File in chunks using File.slice() + FileReader
 *   2. Each chunk is sent as an ArrayBuffer over the "transfer" DataChannel
 *   3. Laptop receives chunks, collects them, and creates a Blob URL for playback
 *   4. Backpressure is handled via bufferedAmount monitoring
 *
 * Chunk protocol:
 *   - First message on transfer channel: JSON string with file metadata
 *     { type: "meta", name: string, size: number, mimeType: string, totalChunks: number }
 *   - Subsequent messages: raw ArrayBuffer chunks
 *   - Final message: JSON string { type: "done" }
 */

const DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB — safe for most WebRTC implementations
const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1MB — pause sending when buffer exceeds this
const BACKPRESSURE_RESUME = 256 * 1024; // 256KB — resume sending when buffer drops below
const MAX_VIDEO_SIZE = 8 * 1024 ** 3;

/**
 * Send a file over a DataChannel in chunks.
 *
 * @param {File} file - The video file to send
 * @param {RTCDataChannel} channel - The transfer data channel
 * @param {object} callbacks - { onProgress, onComplete, onError, onCancel }
 * @returns {{ cancel: () => void }} - Controller to cancel the transfer
 */
export function sendFile(file, channel, callbacks = {}) {
  const { onProgress, onComplete, onError } = callbacks;

  let cancelled = false;
  let offset = 0;
  const chunkSize = DEFAULT_CHUNK_SIZE;
  const totalChunks = Math.ceil(file.size / chunkSize);

  if (!(file instanceof File) || !file.type.startsWith('video/') || file.size <= 0 || file.size > MAX_VIDEO_SIZE) {
    onError?.(new Error('This video is empty, unsupported, or larger than 8 GB.'));
    return { cancel: () => {} };
  }

  const targetChannel = channel?.dataChannel || channel;

  // Send metadata first
  const meta = {
    type: 'meta',
    name: file.name,
    size: file.size,
    mimeType: file.type || 'video/mp4',
    totalChunks,
    chunkSize,
  };

  try {
    targetChannel.send(JSON.stringify(meta));
  } catch (err) {
    onError?.(new Error('Failed to send file metadata: ' + err.message));
    return { cancel: () => {} };
  }

  const reader = new FileReader();
  let chunkIndex = 0;

  function readNextChunk() {
    if (cancelled) return;

    if (offset >= file.size) {
      // Transfer complete
      try {
        targetChannel.send(JSON.stringify({ type: 'done' }));
      } catch {
        // Ignore
      }
      onComplete?.();
      return;
    }

    // Backpressure: wait if buffer is too full
    if (targetChannel.bufferedAmount && targetChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      const onBufferDrain = () => {
        if (targetChannel.bufferedAmount <= BACKPRESSURE_RESUME) {
          if (typeof targetChannel.removeEventListener === 'function') {
            targetChannel.removeEventListener('bufferedamountlow', onBufferDrain);
          }
          readNextChunk();
        }
      };
      if (typeof targetChannel.addEventListener === 'function') {
        try {
          targetChannel.bufferedAmountLowThreshold = BACKPRESSURE_RESUME;
          targetChannel.addEventListener('bufferedamountlow', onBufferDrain);
          return;
        } catch {}
      }
    }

    const end = Math.min(offset + chunkSize, file.size);
    const blob = file.slice(offset, end);
    reader.readAsArrayBuffer(blob);
  }

  reader.onload = (e) => {
    if (cancelled) return;

    try {
      targetChannel.send(e.target.result);
      chunkIndex++;
      offset += e.target.result.byteLength;

      onProgress?.({
        chunkIndex,
        totalChunks,
        bytesSent: offset,
        totalBytes: file.size,
        percent: Math.round((offset / file.size) * 100),
      });

      // Use setTimeout to avoid blocking the UI thread
      setTimeout(readNextChunk, 0);
    } catch (err) {
      onError?.(new Error('Failed to send chunk: ' + err.message));
    }
  };

  reader.onerror = () => {
    onError?.(new Error('Failed to read file chunk'));
  };

  // Start transfer
  readNextChunk();

  return {
    cancel: () => {
      cancelled = true;
      try {
        targetChannel.send(JSON.stringify({ type: 'cancel' }));
      } catch {
        // Ignore
      }
    },
  };
}

/**
 * Receive a file over a DataChannel.
 *
 * @param {RTCDataChannel|object} channel - The transfer data channel or Peer connection
 * @param {object} callbacks - { onMeta, onProgress, onComplete, onError }
 * @returns {{ cancel: () => void }} - Controller to cancel reception
 */
export function receiveFile(channel, callbacks = {}) {
  const { onMeta, onProgress, onComplete, onError } = callbacks;

  const targetChannel = channel?.dataChannel || channel;

  let meta = null;
  let receivedChunks = [];
  let receivedBytes = 0;
  let expectedChunkIndex = 0;
  let cancelled = false;

  const handleMessage = (event) => {
    if (cancelled) return;

    // Normalize data from event or direct data emit
    const data = event && event.data !== undefined ? event.data : event;

    // Check if it's a string message (JSON)
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'meta') {
          if (typeof msg.name !== 'string' || msg.name.length === 0 || msg.name.length > 255
            || !Number.isSafeInteger(msg.size) || msg.size <= 0 || msg.size > MAX_VIDEO_SIZE
            || typeof msg.mimeType !== 'string' || !msg.mimeType.startsWith('video/')
            || !Number.isSafeInteger(msg.totalChunks) || msg.totalChunks <= 0
            || !Number.isSafeInteger(msg.chunkSize) || msg.chunkSize <= 0) {
            onError?.(new Error('The received video metadata is invalid.'));
            cancelled = true;
            return;
          }
          meta = msg;
          receivedChunks = [];
          receivedBytes = 0;
          expectedChunkIndex = 0;
          onMeta?.(meta);
          return;
        }

        if (msg.type === 'done') {
          if (!meta || receivedBytes !== meta.size || expectedChunkIndex !== meta.totalChunks) {
            onError?.(new Error('The video transfer ended before all chunks arrived.'));
            return;
          }
          // Assemble the file
          const blob = new Blob(receivedChunks, {
            type: meta?.mimeType || 'video/mp4',
          });
          const url = URL.createObjectURL(blob);

          onComplete?.({
            blob,
            url,
            name: meta?.name || 'video',
            size: receivedBytes,
            mimeType: meta?.mimeType || 'video/mp4',
          });

          // Clear chunks to free memory
          receivedChunks = [];
          return;
        }

        if (msg.type === 'cancel') {
          receivedChunks = [];
          receivedBytes = 0;
          meta = null;
          expectedChunkIndex = 0;
          onError?.(new Error('The phone cancelled the video transfer.'));
          return;
        }
      } catch {
        // Not a JSON message, ignore
      }
      return;
    }

    // Binary data (ArrayBuffer)
    if (data instanceof ArrayBuffer) {
      if (!meta || data.byteLength === 0 || data.byteLength > meta.chunkSize
        || receivedBytes + data.byteLength > meta.size) {
        onError?.(new Error('The received video chunk is invalid.'));
        cancelled = true;
        return;
      }
      receivedChunks.push(data);
      receivedBytes += data.byteLength;
      expectedChunkIndex++;

      onProgress?.({
        receivedBytes,
        totalBytes: meta?.size || 0,
        percent: meta?.size ? Math.round((receivedBytes / meta.size) * 100) : 0,
        chunkCount: receivedChunks.length,
        totalChunks: meta?.totalChunks || 0,
      });
    }
  };

  const onData = (data) => handleMessage({ data });

  if (targetChannel && typeof targetChannel.addEventListener === 'function') {
    targetChannel.addEventListener('message', handleMessage);
  }
  if (channel && typeof channel.on === 'function' && channel !== targetChannel) {
    channel.on('data', onData);
  }

  return {
    cancel: () => {
      cancelled = true;
      if (targetChannel && typeof targetChannel.removeEventListener === 'function') {
        targetChannel.removeEventListener('message', handleMessage);
      }
      if (channel && typeof channel.off === 'function') {
        channel.off('data', onData);
      }
      receivedChunks = [];
      receivedBytes = 0;
      meta = null;
      expectedChunkIndex = 0;
    },
  };
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format seconds to MM:SS or HH:MM:SS.
 */
export function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
