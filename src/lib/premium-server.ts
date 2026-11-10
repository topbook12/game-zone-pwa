/**
 * Premium server helpers — shared by /api/premium/* and /api/cloud.
 *
 * Tables (self-migrating, memoized per server instance — no manual db step):
 *  - vip_codes:      code (PK), plan, max_devices, note, created_at
 *  - premium_devices: device_id (PK), code, plan, cloud_code (UNIQUE), ts
 *
 * Codes are issued manually with `bun run vip:new` (zero-fee bKash/Nagad
 * flow). The API only ever validates + records activations.
 */
import { getTurso } from '@/lib/turso'

/* ------------------------------ schema ------------------------------ */

let schemaReady: Promise<void> | null = null

export function ensurePremiumSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getTurso()
      await db.execute(`
        CREATE TABLE IF NOT EXISTS vip_codes (
          code TEXT PRIMARY KEY,
          plan TEXT NOT NULL DEFAULT 'vip',
          max_devices INTEGER NOT NULL DEFAULT 1,
          note TEXT,
          created_at INTEGER NOT NULL
        )
      `)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS premium_devices (
          device_id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'vip',
          cloud_code TEXT UNIQUE,
          activated_at INTEGER NOT NULL,
          last_seen INTEGER NOT NULL
        )
      `)
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_premium_devices_code ON premium_devices (code)`
      )
    })()
    schemaReady.catch(() => {
      schemaReady = null // allow retry on next request
    })
  }
  return schemaReady
}

/* ------------------------------ code helpers ------------------------------ */

/** Unambiguous alphabet — no I, O, 0, 1. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomCode(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/** Canonicalize "gzvip abcd 1234" → GZVIP-ABCD-1234 (null when malformed). */
export function canonicalVipCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const m = /^GZVIP([A-HJ-NP-Z2-9]{8})$/.exec(raw)
  if (!m) return null
  const body = m[1]
  return `GZVIP-${body.slice(0, 4)}-${body.slice(4)}`
}

/** Generate a GZC-XXXXXX restore code that is not colliding. */
export async function generateUniqueCloudCode(): Promise<string> {
  const db = getTurso()
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `GZC-${randomCode(6)}`
    const res = await db.execute({
      sql: `SELECT 1 FROM premium_devices WHERE cloud_code = ? LIMIT 1`,
      args: [code],
    })
    if (res.rows.length === 0) return code
  }
  // Practically unreachable — still deterministic-ish fallback
  return `GZC-${randomCode(6)}`
}

/* ------------------------------ queries ------------------------------ */

export interface DevicePremium {
  premium: boolean
  plan: string | null
  cloudCode: string | null
  activatedAt: number | null
}

export async function isDevicePremium(deviceId: string): Promise<DevicePremium> {
  const res = await getTurso().execute({
    sql: `SELECT plan, cloud_code, activated_at FROM premium_devices WHERE device_id = ? LIMIT 1`,
    args: [deviceId],
  })
  const row = res.rows[0]
  if (!row) return { premium: false, plan: null, cloudCode: null, activatedAt: null }
  return {
    premium: true,
    plan: String(row.plan ?? 'vip'),
    cloudCode: row.cloud_code ? String(row.cloud_code) : null,
    activatedAt: Number(row.activated_at ?? 0),
  }
}
