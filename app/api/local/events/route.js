import { isLocalServer, SESSION_RE, subscribe, publish, otherRole, isOnline, getSession } from '../../../../src/server/localHub.js';

export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events stream for one device (laptop or phone) in a local session.
 * Also tells each side when the other one joins or leaves.
 */
export async function GET(req) {
  if (!isLocalServer()) return new Response('Local mode only', { status: 404 });

  const { searchParams } = new URL(req.url);
  const session = searchParams.get('session') || '';
  const role = searchParams.get('role');
  if (!SESSION_RE.test(session) || (role !== 'laptop' && role !== 'phone')) {
    return new Response('Bad session or role', { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe = null;
  let keepAlive = null;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(keepAlive);
    unsubscribe?.();
    if (!isOnline(session, role)) {
      publish(session, otherRole(role), { type: 'peer-left', role });
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (event) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          close();
        }
      };

      unsubscribe = subscribe(session, role, send);

      const peer = otherRole(role);
      const video = getSession(session).video;
      send({
        type: 'hello',
        peerOnline: isOnline(session, peer),
        // Lets a refreshed laptop page pick the finished video back up
        video: video && video.done ? { url: video.url, name: video.name, size: video.size, mimeType: video.mimeType } : null,
      });
      publish(session, peer, { type: 'peer-joined', role });

      keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          close();
        }
      }, 15000);
    },
    cancel() {
      close();
    },
  });

  req.signal?.addEventListener('abort', close);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      // Stops Next's gzip from buffering the stream
      'Content-Encoding': 'none',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
