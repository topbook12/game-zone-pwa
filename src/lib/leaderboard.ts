/**
 * Offline-first leaderboard client.
 *
 * Design goals (cost-effective + resilient):
 *  - Scores ALWAYS save locally first (localStorage), then sync in background.
 *  - If offline / request fails → queued, auto-flushed when connection returns.
 *  - Leaderboard reads are cached locally so the UI works fully offline.
 *  - No accounts, no auth infra — anonymous deviceId identifies the player.
 */

import { unlockAchievement } from '@/lib/achievements'
import { getLang } from '@/lib/i18n'

const DEVICE_KEY = 'gz-device-id'
const NAME_KEY = 'gz-player-name'
const QUEUE_KEY = 'gz-score-queue'
const TOP_CACHE_KEY = (game: string, period: Period) => `gz-top-cache-${game}-${period}`

export type GameId = 'racing' | 'quiz' | 'g2048' | 'snake'

/** Leaderboard window — 'weekly' resets Monday 00:00 UTC. */
export type Period = 'all' | 'weekly'

export interface ScoreRow {
  player: string
  score: number
  at: number
  /** Anonymous device id — lets the client highlight "you" + detect crowns. */
  device?: string
}

export type SubmitStatus = 'synced' | 'queued' | 'offline' | 'rejected'

export interface SubmitOutcome {
  status: SubmitStatus
  rank?: number
  best?: number
}

interface QueueItem {
  game: GameId
  player: string
  deviceId: string
  score: number
  ts: number
}

/* ------------------------------ identity ------------------------------ */

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  try {
    let id = window.localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

export function getPlayerName(): string {
  if (typeof window === 'undefined') return 'Player'
  try {
    return window.localStorage.getItem(NAME_KEY) || autoName()
  } catch {
    return 'Player'
  }
}

/** Deterministic friendly name from deviceId, e.g. "Racer-8f3a". */
function autoName(): string {
  const id = getDeviceId()
  const suffix = id.replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase() || '0000'
  return `Racer-${suffix}`
}

export function setPlayerName(name: string): string {
  const clean =
    name
      .replace(/[^\p{L}\p{N} ._-]/gu, '')
      .trim()
      .slice(0, 16) || autoName()
  try {
    window.localStorage.setItem(NAME_KEY, clean)
  } catch {
    /* ignore */
  }
  return clean
}

/* ------------------------------ submit ------------------------------ */

export async function submitScore(game: GameId, score: number): Promise<SubmitOutcome> {
  const player = getPlayerName()
  const deviceId = getDeviceId()
  const ts = Date.now()

  // Always remember locally (last submitted per game)
  try {
    window.localStorage.setItem(`gz-last-${game}`, JSON.stringify({ score, ts }))
  } catch {
    /* ignore */
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueue({ game, player, deviceId, score, ts })
    return { status: 'offline' }
  }

  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, player, deviceId, score, ts }),
    })
    if (res.status === 422 || res.status === 429) {
      // Anti-cheat said no (implausible score / posting too fast) — drop it
      return { status: 'rejected' }
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { rank?: number; best?: number }
    if (typeof data.rank === 'number' && data.rank >= 1 && data.rank <= 10) {
      unlockAchievement('top10', getLang())
    }
    return { status: 'synced', rank: data.rank, best: data.best }
  } catch {
    enqueue({ game, player, deviceId, score, ts })
    return { status: 'queued' }
  }
}

function enqueue(item: QueueItem): void {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    const queue: QueueItem[] = raw ? (JSON.parse(raw) as QueueItem[]) : []
    queue.push(item)
    // Keep the queue small — only the best score per game while offline matters
    const seen = new Map<string, QueueItem>()
    for (const q of queue) {
      const prev = seen.get(q.game)
      if (!prev || q.score > prev.score) seen.set(q.game, q)
    }
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify([...seen.values()]))
  } catch {
    /* storage blocked — score still lives in memory for this session */
  }
}

/** POST everything queued. Safe to call any time (no-op when empty/online).
 *  Claims the queue up-front (removes it) so concurrent flushes never
 *  double-send the same score; failed items are re-queued once. */
export async function flushScoreQueue(): Promise<number> {
  if (typeof window === 'undefined') return 0
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(QUEUE_KEY)
    if (raw) window.localStorage.removeItem(QUEUE_KEY) // claim immediately
  } catch {
    return 0
  }
  if (!raw) return 0

  let queue: QueueItem[] = []
  try {
    queue = JSON.parse(raw) as QueueItem[]
  } catch {
    return 0
  }
  if (queue.length === 0) return 0

  let sent = 0
  const remaining: QueueItem[] = []
  for (const item of queue) {
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      if (res.ok) {
        sent += 1
      } else if (res.status === 422 || res.status === 429) {
        // Permanently rejected — do NOT re-queue (would ping-pong forever)
      } else {
        remaining.push(item)
      }
    } catch {
      remaining.push(item)
    }
  }
  try {
    if (remaining.length > 0) window.localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
  } catch {
    /* ignore */
  }
  return sent
}

/* ------------------------------ read ------------------------------ */

export interface TopCache {
  rows: ScoreRow[]
  ts: number
  stale: boolean
}

export async function fetchTopScores(
  game: GameId,
  limit = 10,
  period: Period = 'all'
): Promise<TopCache> {
  // Offline → serve local cache immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return readTopCache(game, period)
  }
  try {
    const res = await fetch(`/api/scores?game=${game}&limit=${limit}&period=${period}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { scores: ScoreRow[] }
    const cache: TopCache = { rows: data.scores ?? [], ts: Date.now(), stale: false }
    try {
      window.localStorage.setItem(TOP_CACHE_KEY(game, period), JSON.stringify(cache))
    } catch {
      /* ignore */
    }
    return cache
  } catch {
    return readTopCache(game, period)
  }
}

function readTopCache(game: GameId, period: Period): TopCache {
  try {
    const raw = window.localStorage.getItem(TOP_CACHE_KEY(game, period))
    if (raw) {
      const parsed = JSON.parse(raw) as TopCache
      return { ...parsed, stale: true }
    }
  } catch {
    /* ignore */
  }
  return { rows: [], ts: 0, stale: true }
}

/** Wire once at app start: flush queued scores on load + whenever back online. */
export function initLeaderboardSync(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const flush = () => {
    void flushScoreQueue()
  }
  flush()
  window.addEventListener('online', flush)
  return () => window.removeEventListener('online', flush)
}
