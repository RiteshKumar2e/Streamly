import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Next.js WebRTC Signaling Route Handler
 * 
 * Securely and instantly relays WebRTC SDP offers, answers, and ICE candidates
 * between Laptop and Phone without requiring persistent custom WebSocket servers.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { sessionId, role, message } = body;

    if (!sessionId || !role || !message) {
      return NextResponse.json({ error: 'Missing sessionId, role, or message' }, { status: 400 });
    }

    // Target is the opposite peer
    const target = role === 'phone' ? 'laptop' : 'phone';
    const topic = `streamly-${sessionId}-${target}`;

    // Relay via high-speed global HTTPS pub/sub
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to relay signal' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Signaling POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const role = searchParams.get('role');
    const since = searchParams.get('since') || 'all';

    if (!sessionId || !role) {
      return NextResponse.json({ error: 'Missing sessionId or role' }, { status: 400 });
    }

    const topic = `streamly-${sessionId}-${role}`;
    const url = `https://ntfy.sh/${topic}/json?poll=1&since=${since}`;

    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();

    const lines = text.trim().split('\n').filter(Boolean);
    const messages = [];

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        if (item.event === 'message' && item.message) {
          const parsed = typeof item.message === 'string' ? JSON.parse(item.message) : item.message;
          messages.push({ ...parsed, time: item.time, id: item.id });
        }
      } catch {}
    }

    return NextResponse.json({ messages });
  } catch (err) {
    console.error('Signaling GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
