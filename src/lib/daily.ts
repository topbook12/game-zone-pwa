/**
 * Daily Challenge — seeded so EVERY player gets the same quiz / circuit
 * on the same calendar day (Phase 2, Day 11–25). 100% client-computed:
 * no server cost, works offline, respects the timezone of the device.
 */

import { readStoredNumber, writeStoredNumber } from '@/lib/game-store'

const DAILY_PREFIX = 'gz-daily-' // + YYYY-MM-DD → JSON { quiz: score, racing: score }
const STREAK_KEY = 'gz-daily-streak'
const LAST_KEY = 'gz-daily-last' // YYYY-MM-DD of last completion
const COUNT_KEY = 'gz-daily-count'

/** Deterministic PRNG (mulberry32) — same seed → same sequence everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Today's YYYY-MM-DD in the device timezone. */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Stable numeric seed from a date key → same for everyone on that date. */
export function seedFromDate(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Today's seed — feeds quiz question shuffling + racing track/traffic. */
export function todaySeed(): number {
  return seedFromDate(todayKey())
}

/** Millis until midnight (device timezone) — for the countdown text. */
export function msUntilTomorrow(): number {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  return next.getTime() - now.getTime()
}

export interface DailyProgress {
  quizDone: boolean
  racingDone: boolean
  quizScore: number
  racingScore: number
}

export function readDaily(key = todayKey()): DailyProgress {
  try {
    const raw = window.localStorage.getItem(DAILY_PREFIX + key)
    if (raw) {
      const p = JSON.parse(raw) as Partial<DailyProgress>
      return {
        quizDone: Boolean(p.quizDone),
        racingDone: Boolean(p.racingDone),
        quizScore: p.quizScore ?? 0,
        racingScore: p.racingScore ?? 0,
      }
    }
  } catch {
    /* ignore */
  }
  return { quizDone: false, racingDone: false, quizScore: 0, racingScore: 0 }
}

/** Record a daily-challenge result. Best score of the day is kept. */
export function completeDaily(kind: 'quiz' | 'racing', score: number): void {
  if (typeof window === 'undefined') return
  const key = todayKey()
  const prev = readDaily(key)
  const next: DailyProgress = {
    quizDone: prev.quizDone || kind === 'quiz',
    racingDone: prev.racingDone || kind === 'racing',
    quizScore: kind === 'quiz' ? Math.max(prev.quizScore, score) : prev.quizScore,
    racingScore: kind === 'racing' ? Math.max(prev.racingScore, score) : prev.racingScore,
  }
  try {
    window.localStorage.setItem(DAILY_PREFIX + key, JSON.stringify(next))
  } catch {
    /* ignore */
  }

  // Streak logic — fires the first time ANY daily task completes today
  const wasDone = prev.quizDone || prev.racingDone
  if (!wasDone) {
    const last = window.localStorage.getItem(LAST_KEY)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yKey = todayKey(yesterday)
    const streak = last === yKey ? readStoredNumber(STREAK_KEY, 0) + 1 : 1
    writeStoredNumber(STREAK_KEY, streak)
    writeStoredNumber(COUNT_KEY, readStoredNumber(COUNT_KEY, 0) + 1)
    try {
      window.localStorage.setItem(LAST_KEY, key)
    } catch {
      /* ignore */
    }
  }
}

export function getStreak(): number {
  // Streak breaks if the last completion is older than yesterday
  const last = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_KEY) : null
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (last !== todayKey() && last !== todayKey(yesterday)) return 0
  return readStoredNumber(STREAK_KEY, 0)
}

export function getDailyCompletions(): number {
  return readStoredNumber(COUNT_KEY, 0)
}

/** Fisher–Yates shuffle driven by a seeded PRNG (deterministic). */
export function seededShuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
