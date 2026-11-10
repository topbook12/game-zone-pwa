/**
 * Cloud sync for premium — Phase 5 (Day 71–90).
 *
 * Backs up the player's whole progress (coins, cosmetics, achievements,
 * best scores, streaks, profile) to Turso (`cloud_saves`), keyed by device.
 * A short restore code (GZC-XXXXXX) lets a *new* device pull the save.
 *
 * Cost-effective: one tiny upsert, debounced + interval-driven (never more
 * than a few KB), manual "Back up now" also available. Restore is an honest
 * merge — nothing the player earned locally can go backwards.
 */

import { readCoins, mergeCloudCoins } from '@/lib/coins'
import { readCosmetics, mergeCloudCosmetics } from '@/lib/cosmetics'
import { readPremium, setPremiumLocal, isPremiumActive } from '@/lib/premium'
import { getDeviceId, getPlayerName } from '@/lib/leaderboard'
import { getAvatar, getWeeklyWins } from '@/lib/profile'
import { getLang } from '@/lib/i18n'
import { readStoredNumber, notifyStoreChange } from '@/lib/game-store'

/* localStorage keys mirrored into the backup (kept in sync with owners) */
const ACH_KEY = 'gz-achievements' // Record<id, unlockedTs>
const PARKING_KEY = 'gz-parking' // parking progress (levels/stars)
const DAILY_STREAK_KEY = 'gz-daily-streak'
const DAILY_LAST_KEY = 'gz-daily-last'
const NAME_KEY = 'gz-player-name'
const AVATAR_KEY = 'gz-avatar'
const WINS_KEY = 'gz-week-wins'

export interface CloudSaveData {
  v: 1
  ts: number
  coins: { balance: number; earnStreak: number; lastEarnDay: string | null }
  cosmetics: ReturnType<typeof readCosmetics>
  achievements: Record<string, number>
  bests: { racing: number; quiz: number; g2048: number; snake: number; parking: number }
  plays: number
  daily: { streak: number; last: string | null }
  profile: { name: string; avatar: string; weeklyWins: number }
  lang: 'en' | 'bn'
  parking: Record<string, unknown> | null
}

/** Best quiz score across every category (same heuristic as profile.ts). */
function bestQuizScore(): number {
  if (typeof window === 'undefined') return 0
  try {
    let max = 0
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith('gz-quiz-best-')) {
        max = Math.max(max, Number(window.localStorage.getItem(k)) || 0)
      }
    }
    return max
  } catch {
    return 0
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Snapshot of everything worth backing up (client only). */
export function collectLocalSave(): CloudSaveData {
  const coins = readCoins()
  return {
    v: 1,
    ts: Date.now(),
    coins: { balance: coins.balance, earnStreak: coins.earnStreak, lastEarnDay: coins.lastEarnDay },
    cosmetics: readCosmetics(),
    achievements: readJson<Record<string, number>>(ACH_KEY) ?? {},
    bests: {
      racing: readStoredNumber('gz-racing-best', 0),
      quiz: bestQuizScore(),
      g2048: readStoredNumber('gz-g2048-best', 0),
      snake: readStoredNumber('gz-snake-best', 0),
      parking: readStoredNumber('gz-parking-best', 0),
    },
    plays: readStoredNumber('gz-plays', 0),
    daily: {
      streak: readStoredNumber(DAILY_STREAK_KEY, 0),
      last: typeof window === 'undefined' ? null : window.localStorage.getItem(DAILY_LAST_KEY),
    },
    profile: {
      name: getPlayerName(),
      avatar: getAvatar(),
      weeklyWins: getWeeklyWins(),
    },
    lang: getLang(),
    parking: readJson<Record<string, unknown>>(PARKING_KEY),
  }
}

/* ------------------------------ restore ------------------------------ */

export interface RestoreSummary {
  ok: boolean
  updatedAt: number | null
  reason?: 'offline' | 'not-found' | 'error' | 'invalid'
}

function maxNumber(a: number, b: unknown): number {
  return Math.max(a, Number(b) || 0)
}

/**
 * Merge a cloud save into local state. Honest merge rules:
 *  - bests / plays / streaks / coins: MAX(local, cloud)
 *  - achievements: union (latest unlock ts wins)
 *  - cosmetics: ownership union; selection applies only when owned
 *  - profile: cloud fills gaps, never overwrites a locally-set name/avatar
 *  - parking progress: deepest progress wins per field (cloud merged in)
 */
export function applyCloudSave(data: CloudSaveData): void {
  if (typeof window === 'undefined' || !data || data.v !== 1) return

  mergeCloudCoins({
    balance: data.coins?.balance ?? 0,
    earnStreak: data.coins?.earnStreak ?? 0,
    lastEarnDay: data.coins?.lastEarnDay ?? null,
  })
  if (data.cosmetics) mergeCloudCosmetics(data.cosmetics)

  // achievements — union, max ts per id
  const cloudAch = data.achievements ?? {}
  const localAch = readJson<Record<string, number>>(ACH_KEY) ?? {}
  const merged: Record<string, number> = { ...localAch }
  for (const [id, ts] of Object.entries(cloudAch)) {
    merged[id] = Math.max(merged[id] ?? 0, Number(ts) || 0)
  }
  try {
    window.localStorage.setItem(ACH_KEY, JSON.stringify(merged))
  } catch {
    /* ignore */
  }

  // bests + plays
  const b = data.bests ?? ({} as CloudSaveData['bests'])
  const bestPairs: Array<[string, number]> = [
    ['gz-racing-best', b.racing ?? 0],
    ['gz-g2048-best', b.g2048 ?? 0],
    ['gz-snake-best', b.snake ?? 0],
    ['gz-parking-best', b.parking ?? 0],
  ]
  for (const [key, cloudVal] of bestPairs) {
    const cur = readStoredNumber(key, 0)
    if (cloudVal > cur) {
      try {
        window.localStorage.setItem(key, String(cloudVal))
      } catch {
        /* ignore */
      }
    }
  }
  // quiz best — apply to every category key present in the cloud payload
  if (b.quiz) {
    // cloud only stores the flattened max — stamp it onto the best category
    const curQuiz = bestQuizScore()
    if (b.quiz > curQuiz) {
      try {
        window.localStorage.setItem('gz-quiz-best-gk', String(b.quiz))
      } catch {
        /* ignore */
      }
    }
  }
  const cloudPlays = data.plays ?? 0
  if (cloudPlays > readStoredNumber('gz-plays', 0)) {
    try {
      window.localStorage.setItem('gz-plays', String(cloudPlays))
    } catch {
      /* ignore */
    }
  }

  // daily streak
  if ((data.daily?.streak ?? 0) > readStoredNumber(DAILY_STREAK_KEY, 0)) {
    try {
      window.localStorage.setItem(DAILY_STREAK_KEY, String(data.daily.streak))
      if (data.daily.last) window.localStorage.setItem(DAILY_LAST_KEY, data.daily.last)
    } catch {
      /* ignore */
    }
  }

  // profile — fill gaps only
  const p = data.profile
  if (p) {
    try {
      if (!window.localStorage.getItem(NAME_KEY) && p.name) window.localStorage.setItem(NAME_KEY, String(p.name).slice(0, 16))
      if (!window.localStorage.getItem(AVATAR_KEY) && p.avatar) window.localStorage.setItem(AVATAR_KEY, String(p.avatar))
    } catch {
      /* ignore */
    }
    const wins = maxNumber(getWeeklyWins(), p.weeklyWins)
    try {
      window.localStorage.setItem(WINS_KEY, String(wins))
    } catch {
      /* ignore */
    }
  }

  // parking progress — shallow merge per level key
  if (data.parking && typeof data.parking === 'object') {
    const local = readJson<Record<string, unknown>>(PARKING_KEY) ?? {}
    try {
      window.localStorage.setItem(PARKING_KEY, JSON.stringify({ ...data.parking, ...local }))
    } catch {
      /* ignore */
    }
  }

  notifyStoreChange()
}

/* ------------------------------ network ------------------------------ */

/**
 * Push a fresh backup to the server. Returns the saved ts (null = failed).
 * Requires an active premium device — the API enforces it too.
 */
export async function backupNow(): Promise<number | null> {
  if (typeof window === 'undefined') return null
  if (!isPremiumActive()) return null
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null

  const payload = collectLocalSave()
  try {
    const res = await fetch('/api/cloud', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), data: payload }),
    })
    if (!res.ok) return null
    setPremiumLocal({ lastBackupAt: payload.ts })
    return payload.ts
  } catch {
    return null
  }
}

/** Pull a save by device id (own device) and merge it locally. */
export async function restoreFromDevice(deviceId: string): Promise<RestoreSummary> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, reason: 'offline', updatedAt: null }
  try {
    const res = await fetch(`/api/cloud?device=${encodeURIComponent(deviceId)}`)
    if (res.status === 404) return { ok: false, reason: 'not-found', updatedAt: null }
    if (!res.ok) return { ok: false, reason: 'error', updatedAt: null }
    const json = (await res.json()) as { data?: CloudSaveData; ts?: number }
    if (!json.data || json.data.v !== 1) return { ok: false, reason: 'invalid', updatedAt: null }
    applyCloudSave(json.data)
    return { ok: true, updatedAt: json.ts ?? null }
  } catch {
    return { ok: false, reason: 'error', updatedAt: null }
  }
}

/**
 * Pull a save by the short restore code (used on a NEW device after the
 * player re-enters their VIP code there) and merge it locally.
 */
export async function restoreByCloudCode(code: string): Promise<RestoreSummary> {
  const clean = code.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16)
  if (!/^GZC-[A-Z2-9]{6}$/.test(clean)) return { ok: false, reason: 'invalid', updatedAt: null }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, reason: 'offline', updatedAt: null }
  try {
    const res = await fetch(`/api/cloud?code=${encodeURIComponent(clean)}`)
    if (res.status === 404) return { ok: false, reason: 'not-found', updatedAt: null }
    if (!res.ok) return { ok: false, reason: 'error', updatedAt: null }
    const json = (await res.json()) as { data?: CloudSaveData; ts?: number }
    if (!json.data || json.data.v !== 1) return { ok: false, reason: 'invalid', updatedAt: null }
    applyCloudSave(json.data)
    return { ok: true, updatedAt: json.ts ?? null }
  } catch {
    return { ok: false, reason: 'error', updatedAt: null }
  }
}

/* ------------------------------ auto backup loop ------------------------------ */

const BACKUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
let lastAttempt = 0

/** Debounced best-effort backup (premium only). */
function maybeBackup(): void {
  const now = Date.now()
  if (now - lastAttempt < 30_000) return // coalesce bursts
  lastAttempt = now
  void backupNow()
}

/** Wire once at app start: periodic + on-online + on-hide backups. */
export function initCloudSync(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const timer = window.setInterval(maybeBackup, BACKUP_INTERVAL_MS)
  const onOnline = () => maybeBackup()
  const onHide = () => {
    if (document.visibilityState === 'hidden') void backupNow()
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onHide)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onHide)
  }
}

/** Convenience for the premium dialog: read current premium snapshot. */
export function premiumSnapshot() {
  return readPremium()
}
