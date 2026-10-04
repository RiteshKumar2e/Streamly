import fs from 'fs';
import { once } from 'events';
import { NextResponse } from 'next/server';
import { isLocalServer, SESSION_RE, getSession, publish, videoPath, removeOldVideos } from '../../../../src/server/localHub.js';

export const dynamic = 'force-dynamic';

const MAX_VIDEO_SIZE = 8 * 1024 ** 3;

/**
 * Phone uploads the movie here (raw body, PUT). It is streamed to a temp file on
 * the laptop while progress is pushed to the laptop page over SSE.
 */
export async function PUT(req) {
  if (!isLocalServer()) return NextResponse.json({ error: 'Local mode only' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const session = searchParams.get('session') || '';
  if (!SESSION_RE.test(session)) {
    return NextResponse.json({ error: 'Bad session' }, { status: 400 });
  }

  const size = Number(req.headers.get('content-length') || 0);
  const mimeType = (req.headers.get('content-type') || '').split(';')[0] || 'video/mp4';
  let name = 'video';
  try { name = decodeURIComponent(req.headers.get('x-file-name') || 'video').slice(0, 255); } catch {}

  if (!mimeType.startsWith('video/')) {
    return NextResponse.json({ error: 'Only video files are supported' }, { status: 415 });
  }
  if (size > MAX_VIDEO_SIZE) {
    return NextResponse.json({ error: 'Video is larger than 8 GB' }, { status: 413 });
  }
  if (!req.body) {
    return NextResponse.json({ error: 'Empty upload' }, { status: 400 });
  }

  removeOldVideos(session);
  const state = getSession(session);
  const file = videoPath(session);
  state.video = { name, size, mimeType, done: false, url: null };
  publish(session, 'laptop', { type: 'file-info', name, size, mimeType });

  const out = fs.createWriteStream(file);
  const reader = req.body.getReader();
  let received = 0;
  let lastPercent = -1;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_VIDEO_SIZE) throw new Error('Video is larger than 8 GB');
      if (!out.write(value)) await once(out, 'drain');

      const percent = size ? Math.min(100, Math.floor((received / size) * 100)) : 0;
      if (percent !== lastPercent) {
        lastPercent = percent;
        publish(session, 'laptop', { type: 'transfer-progress', percent, receivedBytes: received, totalBytes: size });
      }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    if (size && received !== size) throw new Error('Upload ended before the whole video arrived');
  } catch (err) {
    out.destroy();
    try { fs.unlinkSync(file); } catch {}
    state.video = null;
    publish(session, 'laptop', { type: 'transfer-error', message: err.message || 'Upload failed' });
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }

  const url = `/api/local/video?session=${session}&v=${Date.now()}`;
  state.video = { name, size: received, mimeType, done: true, url };
  publish(session, 'laptop', { type: 'video-ready', url, name, size: received, mimeType });

  return NextResponse.json({ ok: true, size: received });
}
