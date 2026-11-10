/**
 * Global leaderboard API — the ONLY server route the app needs.
 *
 * GET  /api/scores?game=racing&limit=10  → top scores (edge-cached 30s)
 * POST /api/scores { game, player, score, deviceId } → insert + return rank
 *
 * Cost notes:
 *  - GET responses carry `s-maxage=30, stale-while-revalidate=120` so Vercel's
 *    edge cache absorbs almost all reads — Turso free tier is never stressed.
 *  - POST writes are one tiny INSERT (µs-scale, ~zero cost on Turso free tier).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTurso } from '@/lib/turso'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GAMES = ['racing', 'quiz', 'g2048', 'snake'] as const
type GameId = (typeof GAMES)[number]

const SubmitSchema = z.object({
  game: z.enum(GAMES),
  player: z.string().min(1).max(24),
  score: z.number().int().min(0).max(10_000_000),
  deviceId: z.string().min(8).max(64),
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

  try {
    const rs = await getTurso().execute({
      sql: `SELECT player, score, created_at
            FROM scores
            WHERE game = ?
            ORDER BY score DESC, created_at ASC
            LIMIT ?`,
      args: [game, limit],
    })
    const scores = rs.rows.map((r) => ({
      player: String(r.player),
      score: Number(r.score),
      at: Number(r.created_at),
    }))
    return NextResponse.json(
      { game, scores },
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
  const { game, score, deviceId } = parsed.data
  const player = sanitizeName(parsed.data.player)

  try {
    const db = getTurso()
    await db.execute({
      sql: `INSERT INTO scores (game, player, device_id, score, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [game, player, deviceId, score, Date.now()],
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
