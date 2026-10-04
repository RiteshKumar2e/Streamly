import fs from 'fs';
import { isLocalServer, SESSION_RE, getSession, videoPath } from '../../../../src/server/localHub.js';

export const dynamic = 'force-dynamic';

/**
 * File -> web ReadableStream. Not using Readable.toWeb(): when the browser aborts a
 * range request (every seek does), Node's adapter keeps enqueueing into the closed
 * stream and throws an uncaught ERR_INVALID_STATE. This one stops cleanly.
 */
function fileStream(file, start, end) {
  const source = fs.createReadStream(file, { start, end, highWaterMark: 256 * 1024 });
  let closed = false;

  const stop = () => {
    closed = true;
    source.destroy();
  };

  return new ReadableStream({
    start(controller) {
      source.on('data', (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        } catch {
          stop();
          return;
        }
        // Backpressure: wait for the consumer before reading more
        if (controller.desiredSize !== null && controller.desiredSize <= 0) source.pause();
      });
      source.on('end', () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      });
      source.on('error', (err) => {
        if (closed) return;
        closed = true;
        try { controller.error(err); } catch {}
      });
    },
    pull() {
      if (!closed) source.resume();
    },
    cancel() {
      stop();
    },
  });
}

/** Serves the uploaded movie to the laptop's <video> element, with Range support for seeking. */
export async function GET(req) {
  if (!isLocalServer()) return new Response('Local mode only', { status: 404 });

  const { searchParams } = new URL(req.url);
  const session = searchParams.get('session') || '';
  if (!SESSION_RE.test(session)) return new Response('Bad session', { status: 400 });

  const video = getSession(session).video;
  const file = videoPath(session);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return new Response('Video not found', { status: 404 });
  }
  if (!video || !video.done) return new Response('Video not ready', { status: 409 });

  const total = stat.size;
  const headers = {
    'Content-Type': video.mimeType || 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };

  const range = req.headers.get('range');
  if (!range) {
    return new Response(fileStream(file, 0, total - 1), {
      status: 200,
      headers: { ...headers, 'Content-Length': String(total) },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start = match && match[1] !== '' ? Number(match[1]) : NaN;
  let end = match && match[2] !== '' ? Number(match[2]) : total - 1;
  if (match && match[1] === '' && match[2] !== '') {
    // Suffix range: last N bytes
    start = Math.max(0, total - Number(match[2]));
    end = total - 1;
  }
  if (!match || Number.isNaN(start) || start >= total || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }
  end = Math.min(end, total - 1);

  return new Response(fileStream(file, start, end), {
    status: 206,
    headers: {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
    },
  });
}
