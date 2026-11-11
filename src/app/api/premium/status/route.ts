/**
 * Premium status check — Phase 5 (Day 71–90).
 *
 * GET /api/premium/status?device=…
 *   → { premium, plan, cloudCode, activatedAt }
 *
 * The client caches activation locally (offline-first) and calls this to
 * reconcile: upgrade newly activated devices, drop revoked ones. No-store —
 * the client caches, the server must always reflect reality.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ensurePremiumSchema, isDevicePremium } from '@/lib/premium-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const device = req.nextUrl.searchParams.get('device')
  if (!device || device.length < 8 || device.length > 64) {
    return NextResponse.json({ error: 'device required' }, { status: 400 })
  }
  try {
    await ensurePremiumSchema()
    const status = await isDevicePremium(device)
    // Touch last_seen so inactive devices stay visible for support
    if (status.premium) {
      void getTursoTouch(device)
    }
    return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('GET /api/premium/status failed:', err)
    return NextResponse.json({ premium: false, plan: null, cloudCode: null }, { status: 502 })
  }
}

/** Fire-and-forget last_seen update (never blocks the response). */
async function getTursoTouch(device: string): Promise<void> {
  try {
    const { getTurso } = await import('@/lib/turso')
    await getTurso().execute({
      sql: `UPDATE premium_devices SET last_seen = ? WHERE device_id = ?`,
      args: [Date.now(), device],
    })
  } catch {
    /* ignore */
  }
}
