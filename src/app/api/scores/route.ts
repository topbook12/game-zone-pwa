/**
 * Global leaderboard API — the ONLY score endpoint the app needs.
 *
 * GET  /api/scores?game=racing&limit=10&period=all|weekly
 *      → top scores (edge-cached). `weekly` = since Monday 00:00 UTC.
 * POST /api/scores { game, player, score, deviceId, ts? } → insert + return rank
 *
 * Cost notes:
 *  - GET responses carry `s-maxage=30, stale-while-revalidate=120` so Vercel's
 *    edge cache absorbs almost all reads — Turso free tier is never stressed.
 *  - POST writes are one tiny INSERT (µs-scale, ~zero cost on Turso free tier).
 *
 * Anti-cheat pass #1 (Phase 3):
 *  - Per-game plausibility cap → 422 and the score is dropped.
 *  - Per-device+game rate floor for LIVE submissions → 429.
 *    (Offline-flushed scores carry an old `ts` and skip the rate floor, so a
 *    week-long offline queue can never be wrongly rejected.)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTurso } from '@/lib/turso'
import { weekStartUtcMs } from '@/lib/tournament'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GAMES = ['racing', 'quiz', 'g2048', 'snake'] as const
type GameId = (typeof GAMES)[number]

/** Highest score a legitimate single run can plausibly produce. */
const MAX_SCORE: Record<GameId, number> = {
  racing: 250_000,
  quiz: 20_000,
  g2048: 150_000,
  snake: 25_000,
}

/** Minimum ms between two LIVE posts of the same device for the same game. */
const MIN_INTERVAL_MS = 8_000

const SubmitSchema = z.object({
  game: z.enum(GAMES),
  player: z.string().min(1).max(24),
  score: z.number().int().min(0).max(10_000_000),
  deviceId: z.string().min(8).max(64),
  ts: z.number().int().optional(),
})

/** Keep names readable + safe: letters/digits/spaces/._- only, max 16 chars. */
function sanitizeName(raw: string): string {
  const cleaned = raw
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .trim()
    .slice(0, 16)
  return cleaned.length > 0 ? cleaned : 'Player'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const game = (searchParams.get('game') ?? 'racing') as GameId
  if (!GAMES.includes(game)) {
    return NextResponse.json({ error: 'invalid game' }, { status: 400 })
  }
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 10, 1), 50)
  const period = searchParams.get('period') === 'weekly' ? 'weekly' : 'all'

  try {
    const since = period === 'weekly' ? weekStartUtcMs() : 0
    const rs = await getTurso().execute({
      sql: `SELECT player, score, created_at, device_id
            FROM scores
            WHERE game = ? AND created_at >= ?
            ORDER BY score DESC, created_at ASC
            LIMIT ?`,
      args: [game, since, limit],
    })
    const scores = rs.rows.map((r) => ({
      player: String(r.player),
      score: Number(r.score),
      at: Number(r.created_at),
      device: String(r.device_id ?? ''),
    }))
    return NextResponse.json(
      { game, period, scores },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    )
  } catch (err) {
    console.error('GET /api/scores failed:', err)
    return NextResponse.json({ game, scores: [], error: 'db' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = SubmitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const { game, score, deviceId, ts } = parsed.data
  const player = sanitizeName(parsed.data.player)

  // --- Anti-cheat #1a: plausibility cap --------------------------------
  if (score > MAX_SCORE[game]) {
    return NextResponse.json({ error: 'cap' }, { status: 422 })
  }

  // --- Anti-cheat #1b: live play-speed floor ----------------------------
  // A submission is "live" when its client ts is fresh (within 5 min).
  // Anything older arrives from the offline queue and is always allowed.
  const now = Date.now()
  const live = typeof ts !== 'number' || (ts <= now + 60_000 && now - ts < 5 * 60_000)
  if (live) {
    try {
      const lastRs = await getTurso().execute({
        sql: `SELECT MAX(created_at) AS last FROM scores WHERE device_id = ? AND game = ?`,
        args: [deviceId, game],
      })
      const last = Number(lastRs.rows[0]?.last ?? 0)
      if (last > 0 && now - last < MIN_INTERVAL_MS) {
        return NextResponse.json({ error: 'rate' }, { status: 429 })
      }
    } catch (err) {
      console.error('POST /api/scores rate-check failed:', err)
      // DB hiccup — fall through and accept rather than punish a real player
    }
  }

  try {
    const db = getTurso()
    await db.execute({
      sql: `INSERT INTO scores (game, player, device_id, score, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [game, player, deviceId, score, now],
    })
    const rankRs = await db.execute({
      sql: `SELECT COUNT(*) + 1 AS rank FROM scores WHERE game = ? AND score > ?`,
      args: [game, score],
    })
    const bestRs = await db.execute({
      sql: `SELECT MAX(score) AS best FROM scores WHERE game = ? AND device_id = ?`,
      args: [game, deviceId],
    })
    const rank = Number(rankRs.rows[0]?.rank ?? 1)
    const best = Number(bestRs.rows[0]?.best ?? score)
    return NextResponse.json({ ok: true, rank, best })
  } catch (err) {
    console.error('POST /api/scores failed:', err)
    return NextResponse.json({ error: 'db' }, { status: 502 })
  }
}
