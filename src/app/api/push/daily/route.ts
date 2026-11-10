/**
 * Daily reminder sender — called once a day by the Vercel cron
 * (see vercel.json). Sends a Web Push to opted-in devices whose
 * local time is inside the evening window (~5–10 PM).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel adds it automatically
 * when CRON_SECRET is configured). If the secret is unset (local dev) the
 * endpoint is open — acceptable for now.
 *
 * Free tier: VAPID keys cost nothing; one run/day on Vercel Hobby cron.
 */
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getTurso } from '@/lib/turso'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAYLOAD = JSON.stringify({
  title: '🎮 Game Zone',
  body: '🏁 আজকের ডেইলি চ্যালেঞ্জ রেডি! Today’s challenge is ready — keep your streak 🔥',
  url: '/',
})

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // local dev convenience
  const header = req.headers.get('authorization') ?? ''
  if (header === `Bearer ${secret}`) return true
  return req.nextUrl.searchParams.get('key') === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: 'vapid not configured' }, { status: 503 })
  }
  webpush.setVapidDetails('mailto:game-zone@example.com', publicKey, privateKey)

  let rows
  try {
    const rs = await getTurso().execute({
      sql: `SELECT endpoint, p256dh, auth, tz FROM push_subs`,
    })
    rows = rs.rows
  } catch (err) {
    console.error('GET /api/push/daily (db) failed:', err)
    return NextResponse.json({ error: 'db' }, { status: 502 })
  }

  const nowLocal = (tzMinutes: number) => new Date(Date.now() - tzMinutes * 60_000)
  let sent = 0
  let removed = 0
  let skipped = 0

  for (const row of rows) {
    const tz = Number(row.tz ?? 0)
    // Evening window in the subscriber's local time: 17:00–22:59
    const hour = nowLocal(tz).getUTCHours()
    if (hour < 17 || hour > 22) {
      skipped += 1
      continue
    }
    try {
      await webpush.sendNotification(
        {
          endpoint: String(row.endpoint),
          keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
        },
        PAYLOAD
      )
      sent += 1
    } catch (err) {
      const status =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0
      if (status === 404 || status === 410) {
        // Subscription expired — clean it up
        try {
          await getTurso().execute({
            sql: `DELETE FROM push_subs WHERE endpoint = ?`,
            args: [String(row.endpoint)],
          })
          removed += 1
        } catch {
          /* ignore */
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, removed, skipped, total: rows.length })
}
