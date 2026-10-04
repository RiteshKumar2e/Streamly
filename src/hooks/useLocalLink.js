/**
 * Streamly — useLocalLink Hook (local / hotspot mode)
 *
 * Connects a device to the laptop's own Streamly server: receives events over
 * SSE (/api/local/events) and sends control messages with POST (/api/local/send).
 * EventSource reconnects by itself if the network blips.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export default function useLocalLink(session, role, onEvent) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!session) return undefined;
    const es = new EventSource(
      `/api/local/events?session=${encodeURIComponent(session)}&role=${encodeURIComponent(role)}`
    );
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      let event;
      try { event = JSON.parse(e.data); } catch { return; }
      handlerRef.current?.(event);
    };
    return () => {
      es.close();
      setConnected(false);
    };
  }, [session, role]);

  const send = useCallback(async (message) => {
    if (!session) return false;
    try {
      const res = await fetch('/api/local/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, role, message }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [session, role]);

  return { connected, send };
}
