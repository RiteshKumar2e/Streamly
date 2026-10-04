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
    channel.send(JSON.stringify(meta));
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
        channel.send(JSON.stringify({ type: 'done' }));
      } catch {
        // Ignore
      }
      onComplete?.();
      return;
    }

    // Backpressure: wait if buffer is too full
    if (channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      const onBufferDrain = () => {
        if (channel.bufferedAmount <= BACKPRESSURE_RESUME) {
          channel.removeEventListener('bufferedamountlow', onBufferDrain);
          readNextChunk();
        }
      };
      channel.bufferedAmountLowThreshold = BACKPRESSURE_RESUME;
      channel.addEventListener('bufferedamountlow', onBufferDrain);
      return;
    }

    const end = Math.min(offset + chunkSize, file.size);
    const blob = file.slice(offset, end);
    reader.readAsArrayBuffer(blob);
  }

  reader.onload = (e) => {
    if (cancelled) return;

    try {
      channel.send(e.target.result);
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
        channel.send(JSON.stringify({ type: 'cancel' }));
      } catch {
        // Ignore
      }
    },
  };
}

/**
 * Receive a file over a DataChannel.
 *
 * @param {RTCDataChannel} channel - The transfer data channel
 * @param {object} callbacks - { onMeta, onProgress, onComplete, onError }
 * @returns {{ cancel: () => void }} - Controller to cancel reception
 */
export function receiveFile(channel, callbacks = {}) {
  const { onMeta, onProgress, onComplete, onError } = callbacks;

  let meta = null;
  let receivedChunks = [];
  let receivedBytes = 0;
  let cancelled = false;

  const handleMessage = (event) => {
    if (cancelled) return;

    const { data } = event;

    // Check if it's a string message (JSON)
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'meta') {
          meta = msg;
          receivedChunks = [];
          receivedBytes = 0;
          onMeta?.(meta);
          return;
        }

        if (msg.type === 'done') {
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
          return;
        }
      } catch {
        // Not a JSON message, ignore
      }
      return;
    }

    // Binary data (ArrayBuffer)
    if (data instanceof ArrayBuffer) {
      receivedChunks.push(data);
      receivedBytes += data.byteLength;

      onProgress?.({
        receivedBytes,
        totalBytes: meta?.size || 0,
        percent: meta?.size ? Math.round((receivedBytes / meta.size) * 100) : 0,
        chunkCount: receivedChunks.length,
        totalChunks: meta?.totalChunks || 0,
      });
    }
  };

  channel.addEventListener('message', handleMessage);

  return {
    cancel: () => {
      cancelled = true;
      channel.removeEventListener('message', handleMessage);
      receivedChunks = [];
      receivedBytes = 0;
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
