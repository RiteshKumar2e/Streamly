import { NextResponse } from 'next/server';
import { isLocalServer, getLanAddresses } from '../../../../src/server/localHub.js';

export const dynamic = 'force-dynamic';

/** Tells the laptop page whether local (hotspot) mode is available, and on which IPs. */
export async function GET() {
  if (!isLocalServer()) {
    return NextResponse.json({ local: false, addresses: [] });
  }
  return NextResponse.json({ local: true, addresses: getLanAddresses() });
}
