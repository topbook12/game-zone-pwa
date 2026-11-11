/**
 * VIP code manager — Phase 5 (Day 71–90). MANUAL zero-fee flow:
 *
 *   1. Buyer sends bKash/Nagad payment to the owner.
 *   2. Owner runs:   bun run vip:new          → issues 1 code (1 device)
 *      or            bun run vip:new 5 2     → 5 codes, 2 devices each
 *   3. Owner sends the code to the buyer; the player redeems it in the app
 *      (VIP dialog → Activate VIP).
 *
 * Requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (read from .env.local).
 *
 * Subcommands:
 *   new    [count=1] [maxDevices=1] [note]   — create + insert codes
 *   list                                     — show all codes + activations
 *   revoke <CODE>                            — delete a code (devices keep
 *                                              their local flag until their
 *                                              next online re-check)
 */
import { createClient } from '@libsql/client'
import { readFileSync, existsSync } from 'node:fs'
import { randomCode } from '../src/lib/premium-server'

/** Bun only auto-loads `.env` — parse `.env.local` by hand as a fallback. */
function loadEnvLocal(): void {
  const path = '.env.local'
  if (!existsSync(path)) return
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!m) continue
      const key = m[1]
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    /* ignore */
  }
}
loadEnvLocal()

const url = process.env.TURSO_DATABASE_URL
const token = process.env.TURSO_AUTH_TOKEN
if (!url || !token) {
  console.error('❌ Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (check .env.local)')
  process.exit(1)
}

const db = createClient({ url, authToken: token })

async function ensureSchema() {
  await db.execute(`CREATE TABLE IF NOT EXISTS vip_codes (
    code TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'vip',
    max_devices INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    created_at INTEGER NOT NULL
  )`)
  await db.execute(`CREATE TABLE IF NOT EXISTS premium_devices (
    device_id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'vip',
    cloud_code TEXT UNIQUE,
    activated_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  )`)
}

function genCode(): string {
  // GZVIP-XXXX-XXXX from the unambiguous alphabet (premium-server's randomCode)
  const body = randomCode(8)
  return `GZVIP-${body.slice(0, 4)}-${body.slice(4)}`
}

async function cmdNew(count: number, maxDevices: number, note: string | null) {
  await ensureSchema()
  console.log(`\n🗝  Generating ${count} VIP code(s) · ${maxDevices} device(s) each · note: ${note ?? '—'}\n`)
  const created: string[] = []
  for (let i = 0; i < count; i++) {
    let code = genCode()
    // paranoid uniqueness re-check
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await db.execute({ sql: `SELECT 1 FROM vip_codes WHERE code = ?`, args: [code] })
      if (res.rows.length === 0) break
      code = genCode()
    }
    await db.execute({
      sql: `INSERT INTO vip_codes (code, plan, max_devices, note, created_at) VALUES (?, 'vip', ?, ?, ?)`,
      args: [code, maxDevices, note, Date.now()],
    })
    created.push(code)
    console.log(`   ${code}`)
  }
  console.log(`\n✅ ${created.length} code(s) stored on Turso. Send them to the buyers.`)
}

async function cmdList() {
  await ensureSchema()
  const codes = await db.execute(`SELECT code, max_devices, note, created_at FROM vip_codes ORDER BY created_at DESC LIMIT 200`)
  const activations = await db.execute(`SELECT code, COUNT(*) AS n FROM premium_devices GROUP BY code`)
  const usedBy = new Map<string, number>()
  for (const r of activations.rows) usedBy.set(String(r.code), Number(r.n ?? 0))
  console.log(`\n📋 VIP codes (newest first):\n`)
  for (const r of codes.rows) {
    const code = String(r.code)
    const used = usedBy.get(code) ?? 0
    const max = Number(r.max_devices ?? 1)
    const when = new Date(Number(r.created_at)).toISOString().slice(0, 10)
    console.log(`   ${code}  ·  ${used}/${max} devices  ·  ${when}${r.note ? `  ·  ${String(r.note)}` : ''}`)
  }
  if (codes.rows.length === 0) console.log('   (none yet)')
}

async function cmdRevoke(code: string) {
  await ensureSchema()
  const canonical = code.toUpperCase().replace(/[^A-Z0-9-]/g, '')
  const res = await db.execute({ sql: `DELETE FROM vip_codes WHERE code = ?`, args: [canonical] })
  if (res.rowsAffected > 0) {
    console.log(`🗑  ${canonical} revoked. Devices keep premium until their next online re-check (~next app start).`)
  } else {
    console.log(`⚠️  ${canonical} not found.`)
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'new' || cmd === undefined) {
    const count = Math.min(50, Math.max(1, Number(rest[0]) || 1))
    const maxDevices = Math.min(5, Math.max(1, Number(rest[1]) || 1))
    const note = rest[2] ?? null
    await cmdNew(count, maxDevices, note)
  } else if (cmd === 'list') {
    await cmdList()
  } else if (cmd === 'revoke') {
    if (!rest[0]) {
      console.error('usage: bun run vip:revoke GZVIP-XXXX-XXXX')
      process.exit(1)
    }
    await cmdRevoke(rest[0])
  } else {
    console.error('usage: bun run vip:new [count] [maxDevices] [note] | vip:list | vip:revoke <code>')
    process.exit(1)
  }
}

void main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
