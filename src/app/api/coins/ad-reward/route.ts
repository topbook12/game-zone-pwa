/**
 * Signed ad-reward callback (S2S) — Phase 4 (Day 46–70).
 *
 * When a real ad network is connected, networks that support server-to-server
 * callbacks POST here to certify a completed ad view:
 *
 *   sig = HMAC_SHA256(COIN_SECRET, `${deviceId}:${amount}:${nonce}:${ts}`)  (hex)
 *
 * The signature is verified server-side, timestamps are bounded (±5 min) and
 * nonces are replay-protected. Verified events land in the `coin_events`
 * ledger with reason `s2s:<placement>`. Requires the COIN_SECRET env var.
 *
 * Demo mode (no network yet) never calls this route — the client grants its
 * own demo rewards which still flow through /api/coins for the audit trail.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { getTurso } from '@/lib/turso'

const bodySchema = z.object({
  deviceId: z.string().min(8).max(64),
  placement: z.enum(['coins', 'nitro', 'lifeline', 'double']),
  amount: z.number().int().min(0).max(1000),
  nonce: z.string().min(8).max(64),
  ts: z.number().int().positive(),
  sig: z.string().length(64),
})

const MAX_SKEW_MS = 5 * 60 * 1000
const seenNonces = new Map<string, number>()

function purgeNonces(): void {
  const cutoff = Date.now() - MAX_SKEW_MS * 2
  if (seenNonces.size < 5000) return
  for (const [n, t] of seenNonces) {
    if (t < cutoff) seenNonces.delete(n)
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.COIN_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'ad rewards not configured' }, { status: 503 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const { deviceId, placement, amount, nonce, ts, sig } = parsed

  // Freshness + replay protection
  const now = Date.now()
  if (Math.abs(now - ts) > MAX_SKEW_MS) {
    return NextResponse.json({ error: 'stale timestamp' }, { status: 401 })
  }
  purgeNonces()
  if (seenNonces.has(nonce)) {
    return NextResponse.json({ error: 'replayed nonce' }, { status: 401 })
  }

  const expected = createHmac('sha256', secret).update(`${deviceId}:${amount}:${nonce}:${ts}`).digest('hex')
  const a = Buffer.from(sig, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }
  seenNonces.set(nonce, now)

  try {
    const db = getTurso()
    await db.execute({
      sql: `INSERT INTO coin_events (device_id, type, reason, amount, ts) VALUES (?,?,?,?,?)`,
      args: [deviceId, 'ad', `s2s:${placement}`.slice(0, 32), amount, now],
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'ledger unavailable' }, { status: 502 })
  }
}
