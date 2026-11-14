/**
 * Deploy verification bot — Phase 1 (Day 2–3) of the v3 roadmap.
 *
 * Checks the LIVE production site after every push (manually, from CI, or on a
 * schedule) so a silently-failing deploy pipeline can never hide again — this
 * exact failure (Vercel stuck on v2.0 for 3 days) is what it is built to catch.
 *
 * Usage:  bun scripts/verify-deploy.ts [base-url]
 *         bun run verify:deploy
 *
 * Exit codes: 0 = live site matches the local build · 1 = mismatch / failure
 * (so CI and shell scripts can fail loudly).
 */
import { readFileSync } from 'node:fs'

const BASE = (process.argv[2] ?? 'https://game-zone-pwa.vercel.app').replace(/\/$/, '')

interface Check {
  name: string
  ok: boolean
  detail: string
}

const checks: Check[] = []

function add(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name} — ${detail}`)
}

/** Expected values, derived from the LOCAL build (single source of truth). */
function expectedSwVersion(): string {
  const sw = readFileSync('public/sw.js', 'utf8')
  const m = /CACHE_NAME = '(game-zone-v\d+)'/.exec(sw)
  if (!m) throw new Error('cannot parse local sw.js CACHE_NAME')
  return m[1]
}

function expectedAppVersion(): string {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
  return pkg.version
}

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const wantSw = expectedSwVersion()
  const wantApp = expectedAppVersion()
  console.log(`\n🛰  Verifying ${BASE}`)
  console.log(`   local build expects: sw=${wantSw}  app=${wantApp}\n`)

  // 1. Service Worker reachable + correct cache generation
  const sw = await getText(`${BASE}/sw.js`)
  const swMatch = sw ? /CACHE_NAME = '(game-zone-v\d+)'/.exec(sw) : null
  if (!swMatch) {
    add('service worker', false, `unreachable or malformed (${BASE}/sw.js)`)
  } else {
    add(
      'service worker',
      swMatch[1] === wantSw,
      swMatch[1] === wantSw ? `live ${swMatch[1]} matches local` : `live ${swMatch[1]} ≠ local ${wantSw} — DEPLOY IS STALE`
    )
  }

  // 2. Version endpoint — exists only on builds >= 2.4; a 404 proves staleness
  const verRaw = await getText(`${BASE}/api/version`)
  if (verRaw === null) {
    add('version endpoint', false, 'missing (build older than 2.4) or network error — DEPLOY IS STALE')
  } else {
    try {
      const v = (JSON.parse(verRaw) as { version?: string }).version ?? '?'
      add('version endpoint', v === wantApp, v === wantApp ? `live ${v} matches local` : `live ${v} ≠ local ${wantApp} — DEPLOY IS STALE`)
    } catch {
      add('version endpoint', false, 'invalid JSON response — DEPLOY IS STALE')
    }
  }

  // 3. Leaderboard API healthy (Turso env wired at runtime)
  const scoresRaw = await getText(`${BASE}/api/scores?game=racing`)
  if (scoresRaw === null) {
    add('scores api', false, 'unreachable or non-200')
  } else {
    try {
      const d = JSON.parse(scoresRaw) as { scores?: unknown[] }
      add('scores api', Array.isArray(d.scores), `ok, ${d.scores?.length ?? 0} racing rows`)
    } catch {
      add('scores api', false, 'invalid JSON')
    }
  }

  // 4. Page shell contains the current version footer marker
  const page = await getText(`${BASE}/`)
  const footer = page?.match(/Version (\d+\.\d+)/)?.[1] ?? null
  if (footer === null) {
    add('page shell', false, 'version footer marker not found (old build or SSR issue)')
  } else {
    const wantMajor = wantApp.split('.')[0] + '.' + wantApp.split('.')[1]
    add('page shell', footer === wantMajor, `live footer ${footer}, local ${wantMajor}`)
  }

  const failed = checks.filter((c) => !c.ok).length
  console.log(`\n${failed === 0 ? '🟢 LIVE SITE IS CURRENT' : `🔴 ${failed} CHECK(S) FAILED — production is NOT serving the latest build`}\n`)
  process.exit(failed === 0 ? 0 : 1)
}

void main()
