/**
 * Coin ledger API — Phase 4 (Day 46–70).
 *
 * POST /api/coins  — batch-upload unsynced coin events (client ledger audit).
 * GET  /api/coins?device=… — per-device summary (today's earn + total balance).
 *
 * Cost-effective: one tiny table, batched writes, edge-cached reads.
 * The table self-migrates (memoized per server instance) so `db:init`
 * is never a manual deployment step.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTurso } from '@/lib/turso'

/* ------------------------------ schema ------------------------------ */

const eventSchema = z.object({
  type: z.enum(['play', 'ad', 'spend']),
  reason: z.string().min(1).max(32),
  amount: z.number().int().min(-1_000_000).max(1_000_000),
  ts: z.number().int().positive(),
})

const bodySchema = z.object({
  deviceId: z.string().min(8).max(64),
  events: z.array(eventSchema).min(1).max(50),
})

/* Server-side daily earn caps (UTC day, headroom over the local-day client
 * caps 400/250 to tolerate timezone edges) */
const SERVER_PLAY_CAP = 500
const SERVER_AD_CAP = 300

/* ------------------------------ migration ------------------------------ */

let schemaReady: Promise<void> | null = null

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getTurso()
      await db.execute(`
        CREATE TABLE IF NOT EXISTS coin_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id TEXT NOT NULL,
          type TEXT NOT NULL,
          reason TEXT NOT NULL,
          amount INTEGER NOT NULL,
          ts INTEGER NOT NULL
        )
      `)
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_coin_events_device_ts ON coin_events (device_id, ts)`
      )
    })()
    schemaReady.catch(() => {
      schemaReady = null // allow retry on next request
    })
  }
  return schemaReady
}

/* ------------------------------ helpers ------------------------------ */

function utcDayBounds(): { start: number; end: number } {
  const now = new Date()
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return { start, end: start + 86_400_000 }
}

/* ------------------------------ GET ------------------------------ */

export async function GET(req: NextRequest) {
  const device = req.nextUrl.searchParams.get('device')
  if (!device || device.length < 8 || device.length > 64) {
    return NextResponse.json({ error: 'device required' }, { status: 400 })
  }
  try {
    await ensureSchema()
    const db = getTurso()
    const { start, end } = utcDayBounds()
    const res = await db.execute({
      sql: `SELECT
              COALESCE(SUM(CASE WHEN type = 'play' THEN amount ELSE 0 END), 0) AS play,
              COALESCE(SUM(CASE WHEN type = 'ad' THEN amount ELSE 0 END), 0) AS ad,
              COALESCE(SUM(amount), 0) AS balance,
              COUNT(*) AS events
            FROM coin_events WHERE device_id = ?`,
      args: [device],
    })
    const today = await db.execute({
      sql: `SELECT
              COALESCE(SUM(CASE WHEN type = 'play' THEN amount ELSE 0 END), 0) AS play,
              COALESCE(SUM(CASE WHEN type = 'ad' THEN amount ELSE 0 END), 0) AS ad
            FROM coin_events WHERE device_id = ? AND ts >= ? AND ts < ?`,
      args: [device, start, end],
    })
    const row = res.rows[0] ?? {}
    const t = today.rows[0] ?? {}
    return NextResponse.json(
      {
        balance: Number(row.balance ?? 0),
        events: Number(row.events ?? 0),
        today: { play: Number(t.play ?? 0), ad: Number(t.ad ?? 0) },
        caps: { play: SERVER_PLAY_CAP, ad: SERVER_AD_CAP },
      },
      { headers: { 'Cache-Control': 's-maxage=15, stale-while-revalidate=60' } }
    )
  } catch {
    return NextResponse.json({ error: 'ledger unavailable' }, { status: 502 })
  }
}

/* ------------------------------ POST ------------------------------ */

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const { deviceId, events } = parsed

  try {
    await ensureSchema()
    const db = getTurso()
    const { start, end } = utcDayBounds()

    // Current UTC-day earn totals for this device
    const sums = await db.execute({
      sql: `SELECT type, SUM(amount) AS total FROM coin_events
            WHERE device_id = ? AND ts >= ? AND ts < ? AND type IN ('play','ad')
            GROUP BY type`,
      args: [deviceId, start, end],
    })
    let play = 0
    let ad = 0
    for (const r of sums.rows) {
      if (r.type === 'play') play = Number(r.total ?? 0)
      if (r.type === 'ad') ad = Number(r.total ?? 0)
    }

    const accepted: typeof events = []
    for (const ev of events) {
      if (ev.type === 'play' && ev.amount > 0) {
        if (play + ev.amount > SERVER_PLAY_CAP) continue
        play += ev.amount
      } else if (ev.type === 'ad' && ev.amount > 0) {
        if (ad + ev.amount > SERVER_AD_CAP) continue
        ad += ev.amount
      }
      accepted.push(ev)
    }

    if (accepted.length > 0) {
      await db.batch(
        accepted.map((ev) => ({
          sql: `INSERT INTO coin_events (device_id, type, reason, amount, ts) VALUES (?,?,?,?,?)`,
          args: [deviceId, ev.type, ev.reason.slice(0, 32), ev.amount, ev.ts],
        }))
      )
    }

    return NextResponse.json({
      ok: true,
      accepted: accepted.length,
      dropped: events.length - accepted.length,
    })
  } catch {
    return NextResponse.json({ error: 'ledger unavailable' }, { status: 502 })
  }
}
