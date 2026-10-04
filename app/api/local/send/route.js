import { NextResponse } from 'next/server';
import { isLocalServer, SESSION_RE, publish, otherRole, isOnline } from '../../../../src/server/localHub.js';

export const dynamic = 'force-dynamic';

const ALLOWED = ['play', 'pause', 'seek', 'volume', 'mute', 'state', 'ready', 'error'];

/** Relays a control message (play/pause/seek/state...) to the other device. */
export async function POST(req) {
  if (!isLocalServer()) return NextResponse.json({ error: 'Local mode only' }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { session, role, message } = body || {};
  if (!SESSION_RE.test(session || '') || (role !== 'laptop' && role !== 'phone')
    || !message || !ALLOWED.includes(message.type)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const target = otherRole(role);
  publish(session, target, message);
  return NextResponse.json({ ok: true, delivered: isOnline(session, target) });
}
