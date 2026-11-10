/**
 * Push subscription registry — stores Web Push endpoints on Turso.
 *
 * POST   /api/push/subscribe  { subscription, tz }  → upsert one device
 * DELETE /api/push/subscribe  { endpoint }          → remove (opt-out)
 *
 * Cost: rows are tiny; the daily cron is the only sender. No accounts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTurso } from '@/lib/turso'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SubSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(500),
    keys: z.object({
      p256dh: z.string().min(10).max(300),
      auth: z.string().min(6).max(300),
    }),
  }),
  /** getTimezoneOffset() minutes (UTC − local). Lets the cron hit ~7 PM local. */
  tz: z.number().int().min(-900).max(900),
})

const UnsubSchema = z.object({
  endpoint: z.string().url().max(500),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = SubSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const { endpoint, keys } = parsed.data.subscription
  try {
    await getTurso().execute({
      sql: `INSERT INTO push_subs (endpoint, p256dh, auth, tz, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE
              SET p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz`,
      args: [endpoint, keys.p256dh, keys.auth, parsed.data.tz, Date.now()],
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/push/subscribe failed:', err)
    return NextResponse.json({ error: 'db' }, { status: 502 })
  }
}

export async function DELETE(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = UnsubSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  try {
    await getTurso().execute({
      sql: `DELETE FROM push_subs WHERE endpoint = ?`,
      args: [parsed.data.endpoint],
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/push/subscribe failed:', err)
    return NextResponse.json({ error: 'db' }, { status: 502 })
  }
}
