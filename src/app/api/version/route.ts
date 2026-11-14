/**
 * GET /api/version — which build is live on the server?
 *
 * The client version guard (pwa-register.tsx) compares this against its own
 * bundled APP_VERSION: if the server is NEWER, the page is stale and shows the
 * one-tap refresh card. no-store so the answer is always fresh.
 */
import { NextResponse } from 'next/server'
import { APP_VERSION } from '@/lib/app-version'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
