/**
 * One-time DB bootstrap: creates the leaderboard tables on Turso.
 *
 * Usage:  bun run db:init
 * Requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (in .env.local).
 */
import { createClient } from '@libsql/client'
import { readFileSync, existsSync } from 'node:fs'

function loadEnvFallback() {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) return
  const path = '.env.local'
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnvFallback()

const url = process.env.TURSO_DATABASE_URL
const token = process.env.TURSO_AUTH_TOKEN
if (!url || !token) {
  console.error('✗ Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN')
  process.exit(1)
}

const db = createClient({ url, authToken: token })

await db.execute(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game TEXT NOT NULL,
    player TEXT NOT NULL,
    device_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )
`)
await db.execute(
  `CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores (game, score DESC)`
)
await db.execute(
  `CREATE INDEX IF NOT EXISTS idx_scores_device ON scores (device_id, game)`
)

// Phase 3 — referrals: one row per device that joined through a ?ref= link
await db.execute(`
  CREATE TABLE IF NOT EXISTS referrals (
    device_id TEXT PRIMARY KEY,
    ref TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`)
await db.execute(`CREATE INDEX IF NOT EXISTS idx_referrals_ref ON referrals (ref)`)

// Phase 3 — web push subscriptions for the daily reminder
await db.execute(`
  CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    tz INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`)

console.log('✓ Turso ready — tables ensured at', url)
