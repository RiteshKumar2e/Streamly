import fs from 'fs';
import { Readable } from 'stream';
import { isLocalServer, SESSION_RE, getSession, videoPath } from '../../../../src/server/localHub.js';

export const dynamic = 'force-dynamic';

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
    return new Response(Readable.toWeb(fs.createReadStream(file)), {
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

  return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), {
    status: 206,
    headers: {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
    },
  });
}
