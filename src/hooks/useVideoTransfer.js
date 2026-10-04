/**
 * Streamly — useVideoTransfer Hook
 *
 * Manages video file selection, transfer progress, and video playback URL.
 */

import { useState, useRef, useCallback } from 'react';
import { sendFile, receiveFile, formatBytes } from '../services/transfer.js';

export default function useVideoTransfer() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [transferProgress, setTransferProgress] = useState(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isTransferComplete, setIsTransferComplete] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [transferError, setTransferError] = useState(null);

  const transferControllerRef = useRef(null);
  const videoUrlRef = useRef(null);

  /**
   * Handle file selection from the file picker.
   */
  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    // Validate it's a video
    if (!file.type.startsWith('video/')) {
      setTransferError('Please select a video file.');
      return;
    }

    setSelectedFile({
      file,
      name: file.name,
      size: file.size,
      sizeFormatted: formatBytes(file.size),
      type: file.type,
    });
    setTransferError(null);
  }, []);

  /**
   * Start sending the selected file over a data channel.
   */
  const startSending = useCallback((transferChannel) => {
    if (!selectedFile?.file || !transferChannel) {
      setTransferError('No file selected or transfer channel not ready.');
      return;
    }

    setIsTransferring(true);
    setTransferProgress({ percent: 0, bytesSent: 0, totalBytes: selectedFile.file.size });
    setTransferError(null);

    const controller = sendFile(selectedFile.file, transferChannel, {
      onProgress: (progress) => {
        setTransferProgress(progress);
      },
      onComplete: () => {
        setIsTransferring(false);
        setIsTransferComplete(true);
        setTransferProgress({ percent: 100, bytesSent: selectedFile.file.size, totalBytes: selectedFile.file.size });
      },
      onError: (err) => {
        setIsTransferring(false);
        setTransferError('Transfer failed: ' + err.message);
      },
    });

    transferControllerRef.current = controller;
  }, [selectedFile]);

  /**
   * Start receiving a file on a data channel (laptop side).
   */
  const startReceiving = useCallback((transferChannel) => {
    if (!transferChannel) return;

    const controller = receiveFile(transferChannel, {
      onMeta: (meta) => {
        setVideoMeta({
          name: meta.name,
          size: meta.size,
          sizeFormatted: formatBytes(meta.size),
          mimeType: meta.mimeType,
        });
        setIsTransferring(true);
        setTransferProgress({ percent: 0, receivedBytes: 0, totalBytes: meta.size });
      },
      onProgress: (progress) => {
        setTransferProgress(progress);
      },
      onComplete: (result) => {
        setIsTransferring(false);
        setIsTransferComplete(true);

        // Revoke old URL if any
        if (videoUrlRef.current) {
          URL.revokeObjectURL(videoUrlRef.current);
        }

        videoUrlRef.current = result.url;
        setVideoUrl(result.url);
        setVideoMeta((prev) => ({
          ...prev,
          name: result.name,
          size: result.size,
          sizeFormatted: formatBytes(result.size),
          mimeType: result.mimeType,
        }));
      },
      onError: (err) => {
        setIsTransferring(false);
        setTransferError('Receive failed: ' + err.message);
      },
    });

    transferControllerRef.current = controller;
  }, []);

  /**
   * Cancel the current transfer.
   */
  const cancelTransfer = useCallback(() => {
    if (transferControllerRef.current) {
      transferControllerRef.current.cancel();
      transferControllerRef.current = null;
    }
    setIsTransferring(false);
    setTransferProgress(null);
  }, []);

  /**
   * Clean up — revoke object URLs.
   */
  const cleanup = useCallback(() => {
    cancelTransfer();
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setVideoUrl(null);
    setVideoMeta(null);
    setSelectedFile(null);
    setIsTransferComplete(false);
    setTransferError(null);
    setTransferProgress(null);
  }, [cancelTransfer]);

  return {
    selectedFile,
    transferProgress,
    isTransferring,
    isTransferComplete,
    videoUrl,
    videoMeta,
    transferError,
    handleFileSelect,
    startSending,
    startReceiving,
    cancelTransfer,
    cleanup,
    setTransferError,
  };
}
