/**
 * Cloud save API — Phase 5 (Day 71–90). Premium devices only.
 *
 * PUT  /api/cloud { deviceId, data }  → upsert the device's progress backup
 * GET  /api/cloud?device=…            → own save (premium required)
 * GET  /api/cloud?code=GZC-XXXXXX     → save by restore code (new device)
 *
 * The payload is the client's full progress snapshot (~a few KB). Stored
 * as one JSON blob per device — one row upsert, no fan-out writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTurso } from '@/lib/turso'
import { ensurePremiumSchema, isDevicePremium } from '@/lib/premium-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 60_000

let saveSchemaReady: Promise<void> | null = null

function ensureSaveSchema(): Promise<void> {
  if (!saveSchemaReady) {
    saveSchemaReady = (async () => {
      await getTurso().execute(`
        CREATE TABLE IF NOT EXISTS cloud_saves (
          device_id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          ts INTEGER NOT NULL
        )
      `)
    })()
    saveSchemaReady.catch(() => {
      saveSchemaReady = null
    })
  }
  return saveSchemaReady
}

const putSchema = z.object({
  deviceId: z.string().min(8).max(64),
  data: z.object({ v: z.number().int() }).passthrough(),
})

/* ------------------------------ PUT ------------------------------ */

export async function PUT(req: NextRequest) {
  let parsed: z.infer<typeof putSchema>
  try {
    parsed = putSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const serialized = JSON.stringify(parsed.data)
  if (serialized.length > MAX_BYTES) {
    return NextResponse.json({ error: 'too large' }, { status: 413 })
  }

  try {
    await ensurePremiumSchema()
    const status = await isDevicePremium(parsed.deviceId)
    if (!status.premium) {
      return NextResponse.json({ error: 'premium required' }, { status: 403 })
    }
    await ensureSaveSchema()
    const ts = Date.now()
    await getTurso().execute({
      sql: `INSERT INTO cloud_saves (device_id, data, ts) VALUES (?, ?, ?)
            ON CONFLICT (device_id) DO UPDATE SET data = excluded.data, ts = excluded.ts`,
      args: [parsed.deviceId, serialized, ts],
    })
    return NextResponse.json({ ok: true, ts })
  } catch (err) {
    console.error('PUT /api/cloud failed:', err)
    return NextResponse.json({ error: 'db' }, { status: 502 })
  }
}

/* ------------------------------ GET ------------------------------ */

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const code = params.get('code')
  const device = params.get('device')

  if (!code && (!device || device.length < 8 || device.length > 64)) {
    return NextResponse.json({ error: 'device or code required' }, { status: 400 })
  }

  try {
    await ensurePremiumSchema()
    await ensureSaveSchema()
    const db = getTurso()

    let deviceId: string | null = null
    if (code) {
      const clean = code.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16)
      const res = await db.execute({
        sql: `SELECT device_id FROM premium_devices WHERE cloud_code = ? LIMIT 1`,
        args: [clean],
      })
      deviceId = res.rows[0] ? String(res.rows[0].device_id) : null
      if (!deviceId) return NextResponse.json({ error: 'not found' }, { status: 404 })
    } else if (device) {
      // Own-device read — premium required
      const status = await isDevicePremium(device)
      if (!status.premium) {
        return NextResponse.json({ error: 'premium required' }, { status: 403 })
      }
      deviceId = device
    }

    const res = await db.execute({
      sql: `SELECT data, ts FROM cloud_saves WHERE device_id = ? LIMIT 1`,
      args: [deviceId!],
    })
    const row = res.rows[0]
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
    let data: unknown
    try {
      data = JSON.parse(String(row.data))
    } catch {
      return NextResponse.json({ error: 'corrupt' }, { status: 500 })
    }
    return NextResponse.json(
      { data, ts: Number(row.ts ?? 0) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('GET /api/cloud failed:', err)
    return NextResponse.json({ error: 'db' }, { status: 502 })
  }
}
