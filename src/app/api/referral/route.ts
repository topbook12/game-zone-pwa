/**
 * Referral API — counts installs that arrive through a player's ?ref= link.
 *
 * POST /api/referral { ref, deviceId } → registers the install (once per device)
 * GET  /api/referral?ref=code          → { count } (edge-cached 60s)
 *
 * Cost: one tiny table on Turso free tier; reads are cached at the edge.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTurso } from '@/lib/turso'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RefSchema = z.object({
  ref: z.string().regex(/^[a-zA-Z0-9]{4,16}$/),
  deviceId: z.string().min(8).max(64),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ref = (searchParams.get('ref') ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)
  if (ref.length < 4) {
    return NextResponse.json({ error: 'invalid ref' }, { status: 400 })
  }
  try {
    const rs = await getTurso().execute({
      sql: `SELECT COUNT(*) AS count FROM referrals WHERE ref = ?`,
      args: [ref],
    })
    return NextResponse.json(
      { ref, count: Number(rs.rows[0]?.count ?? 0) },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (err) {
    console.error('GET /api/referral failed:', err)
    return NextResponse.json({ ref, count: 0, error: 'db' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = RefSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  try {
    await getTurso().execute({
      sql: `INSERT INTO referrals (device_id, ref, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(device_id) DO NOTHING`,
      args: [parsed.data.deviceId, parsed.data.ref.toLowerCase(), Date.now()],
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/referral failed:', err)
    return NextResponse.json({ error: 'db' }, { status: 502 })
  }
}
