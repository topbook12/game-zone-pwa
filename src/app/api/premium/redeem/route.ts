/**
 * VIP code redemption — Phase 5 (Day 71–90).
 *
 * POST /api/premium/redeem { code, deviceId }
 *   → 200 { ok, plan, cloudCode, activatedAt }
 *   → 404 invalid code · 409 device slots exhausted · 400 bad payload · 502 db
 *
 * Manual zero-fee flow: the owner receives bKash/Nagad payment, issues a
 * code with `bun run vip:new`, sends it to the buyer. One code can activate
 * `max_devices` devices (default 1; use 2 for phone + tablet).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTurso } from '@/lib/turso'
import {
  ensurePremiumSchema,
  canonicalVipCode,
  generateUniqueCloudCode,
} from '@/lib/premium-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  code: z.string().min(8).max(24),
  deviceId: z.string().min(8).max(64),
})

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const code = canonicalVipCode(parsed.code)
  if (!code) return NextResponse.json({ error: 'invalid' }, { status: 404 })
  const { deviceId } = parsed

  try {
    await ensurePremiumSchema()
    const db = getTurso()

    // 1) Does this VIP code exist?
    const codeRes = await db.execute({
      sql: `SELECT code, plan, max_devices FROM vip_codes WHERE code = ? LIMIT 1`,
      args: [code],
    })
    const codeRow = codeRes.rows[0]
    if (!codeRow) return NextResponse.json({ error: 'invalid' }, { status: 404 })
    const plan = String(codeRow.plan ?? 'vip')
    const maxDevices = Math.max(1, Number(codeRow.max_devices ?? 1))

    // 2) Already activated on this device → idempotent success
    const existing = await db.execute({
      sql: `SELECT code, cloud_code, activated_at FROM premium_devices WHERE device_id = ? LIMIT 1`,
      args: [deviceId],
    })
    const prev = existing.rows[0]
    if (prev) {
      if (String(prev.code ?? '') === code) {
        // Same code again — keep everything, just touch last_seen
        await db.execute({
          sql: `UPDATE premium_devices SET last_seen = ? WHERE device_id = ?`,
          args: [Date.now(), deviceId],
        })
        let cloudCode = prev.cloud_code ? String(prev.cloud_code) : null
        if (!cloudCode) {
          cloudCode = await generateUniqueCloudCode()
          await db.execute({
            sql: `UPDATE premium_devices SET cloud_code = ? WHERE device_id = ?`,
            args: [cloudCode, deviceId],
          })
        }
        return NextResponse.json({
          ok: true,
          plan,
          cloudCode,
          activatedAt: Number(prev.activated_at ?? Date.now()),
        })
      }
      // Device already premium with another code → treat as upgrade, keep slots honest
    }

    // 3) Device slots for this code (excluding this device)
    const countRes = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM premium_devices WHERE code = ? AND device_id != ?`,
      args: [code, deviceId],
    })
    const used = Number(countRes.rows[0]?.n ?? 0)
    if (used >= maxDevices) {
      return NextResponse.json({ error: 'limit' }, { status: 409 })
    }

    // 4) Activate (keep any existing cloud code on this device)
    const now = Date.now()
    let cloudCode = prev?.cloud_code ? String(prev.cloud_code) : null
    if (!cloudCode) cloudCode = await generateUniqueCloudCode()

    if (prev) {
      await db.execute({
        sql: `UPDATE premium_devices
              SET code = ?, plan = ?, last_seen = ?
              WHERE device_id = ?`,
        args: [code, plan, now, deviceId],
      })
    } else {
      await db.execute({
        sql: `INSERT INTO premium_devices (device_id, code, plan, cloud_code, activated_at, last_seen)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [deviceId, code, plan, cloudCode, now, now],
      })
    }

    return NextResponse.json({ ok: true, plan, cloudCode, activatedAt: now })
  } catch (err) {
    console.error('POST /api/premium/redeem failed:', err)
    return NextResponse.json({ error: 'db' }, { status: 502 })
  }
}
