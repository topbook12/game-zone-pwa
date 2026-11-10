/**
 * Coin economy — Phase 4 (Day 46–70).
 *
 * Design goals (cost-effective + honest + offline-first):
 *  - Balance lives in localStorage (source of truth for the UI, works offline).
 *  - Every earn/spend is recorded as an event; events are batch-synced to the
 *    server ledger (`coin_events` on Turso) with claim-then-send, exactly like
 *    scores — nothing is lost when offline.
 *  - Daily caps keep payouts controlled: 400 play coins/day, 10 ads/day.
 *  - Streak bonus: +5% play coins per consecutive earning day (max +25%).
 */

import { useSyncExternalStore } from 'react'
import { isPremiumActive, PREMIUM_COIN_MULT } from '@/lib/premium'

/* ------------------------------ constants ------------------------------ */

export const PLAY_DAILY_CAP = 400
export const AD_COINS = 25
export const MAX_ADS_PER_DAY = 10
export const STREAK_BONUS_STEP = 0.05
export const STREAK_BONUS_MAX = 0.25

export type CoinGame = 'racing' | 'quiz' | 'g2048' | 'snake' | 'parking'

/** Per-play coin formulas — small on purpose (cap = controlled payout). */
export function computePlayCoins(game: CoinGame, score: number): number {
  const base =
    game === 'racing'
      ? Math.floor(score / 400)
      : game === 'quiz'
        ? Math.floor(score / 20)
        : game === 'g2048'
          ? Math.floor(score / 200)
          : game === 'parking'
            ? Math.floor(score / 150)
            : Math.floor(score / 50)
  return Math.max(0, Math.min(game === 'racing' ? 40 : game === 'parking' ? 15 : 30, base))
}

/** Daily play-coin cap — premium players get 2× (server mirrors this). */
export function playDailyCap(): number {
  return isPremiumActive() ? PLAY_DAILY_CAP * PREMIUM_COIN_MULT : PLAY_DAILY_CAP
}

/* ------------------------------ state ------------------------------ */

export type CoinEventType = 'play' | 'ad' | 'spend'

export interface CoinEvent {
  type: CoinEventType
  /** short reason: 'play:racing', 'ad:nitro', 'shop:car-gold', … */
  reason: string
  amount: number
  ts: number
}

interface CoinState {
  balance: number
  /** local day key 'YYYY-MM-DD' the counters belong to */
  day: string
  playToday: number
  adCoinsToday: number
  adsToday: number
  earnStreak: number
  lastEarnDay: string | null
  /** unsynced ledger events */
  queue: CoinEvent[]
}

const STATE_KEY = 'gz-coins'
const listeners = new Set<() => void>()

/* Snapshot cache — useSyncExternalStore requires getSnapshot to return a
 * STABLE value until the store actually changes (fresh objects per call
 * would loop forever). Cache key = raw JSON + local date (so the daily
 * roll is re-evaluated after midnight). */
let snapCache: CoinState | null = null
let snapKey: string | null = null
let ssrSnapshot: CoinState | null = null

/** Stable server snapshot — React requires a cached reference here too. */
function getServerSnapshot(): CoinState {
  if (!ssrSnapshot) ssrSnapshot = defaultState()
  return ssrSnapshot
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return todayKey(d)
}

function defaultState(): CoinState {
  return {
    balance: 0,
    day: todayKey(),
    playToday: 0,
    adCoinsToday: 0,
    adsToday: 0,
    earnStreak: 0,
    lastEarnDay: null,
    queue: [],
  }
}

function subscribeCoins(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

function notify(): void {
  listeners.forEach((l) => l())
}

export function readCoins(): CoinState {
  if (typeof window === 'undefined') return defaultState()
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STATE_KEY)
  } catch {
    raw = null
  }
  const key = `${todayKey()}|${raw}`
  if (snapKey === key && snapCache) return snapCache
  let parsed: CoinState
  try {
    parsed = raw
      ? { ...defaultState(), ...(JSON.parse(raw) as Partial<CoinState>) }
      : defaultState()
  } catch {
    parsed = defaultState()
  }
  // Roll the day counters if we crossed midnight since the last write
  if (parsed.day !== todayKey()) {
    parsed = { ...parsed, day: todayKey(), playToday: 0, adCoinsToday: 0, adsToday: 0 }
  }
  snapKey = key
  snapCache = parsed
  return parsed
}

function writeCoins(state: CoinState): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    /* storage blocked — balance still lives in memory for this session */
  }
  notify()
}

function mutate(fn: (s: CoinState) => CoinState): void {
  writeCoins(fn(readCoins()))
}

/** Public reactive hook — SSR renders defaults, hydrates after mount. */
export function useCoins(): CoinState {
  return useSyncExternalStore(subscribeCoins, readCoins, getServerSnapshot)
}

/** +5% per consecutive earning day (starting day 2), max +25%. */
export function streakBonusPct(state = readCoins()): number {
  if (state.earnStreak < 2) return 0
  return Math.round(Math.min(STREAK_BONUS_MAX, (state.earnStreak - 1) * STREAK_BONUS_STEP) * 100)
}

function trackEarnStreak(s: CoinState): CoinState {
  const today = todayKey()
  if (s.lastEarnDay === today) return s
  return {
    ...s,
    earnStreak: s.lastEarnDay === yesterdayKey() ? s.earnStreak + 1 : 1,
    lastEarnDay: today,
  }
}

function enqueueEvent(queue: CoinEvent[], ev: CoinEvent): CoinEvent[] {
  // Keep the queue bounded — drop the oldest beyond 100
  return [...queue, ev].slice(-100)
}

/* ------------------------------ earn / spend ------------------------------ */

/** Award play coins for a finished game (caps + streak bonus applied).
 *  Premium players earn 2× (×2 also widens the daily cap).
 *  Returns the granted amount (0 when the daily cap is hit). */
export function earnPlayCoins(
  game: CoinGame,
  score: number
): number {
  const s = readCoins()
  const mult = isPremiumActive() ? PREMIUM_COIN_MULT : 1
  const base = computePlayCoins(game, score) * mult
  if (base <= 0) return 0
  const room = Math.max(0, playDailyCap() - s.playToday)
  if (room <= 0) return 0
  const bonus = Math.round(base * streakBonusPct(s))
  const grant = Math.min(room, base + bonus)
  const ev: CoinEvent = { type: 'play', reason: `play:${game}`, amount: grant, ts: Date.now() }
  mutate((cur) =>
    trackEarnStreak({
      ...cur,
      balance: cur.balance + grant,
      playToday: cur.playToday + grant,
      queue: enqueueEvent(cur.queue, ev),
    })
  )
  return grant
}

/**
 * Reward for a completed rewarded ad. `double` placements grant the doubled
 * play reward instead of the flat AD_COINS. Returns the granted amount
 * (0 when the daily ad limit is reached).
 */
export function grantAdReward(placement: 'coins' | 'nitro' | 'lifeline' | 'double', doubleAmount = 0): number {
  const s = readCoins()
  if (s.adsToday >= MAX_ADS_PER_DAY) return 0
  const mult = isPremiumActive() ? PREMIUM_COIN_MULT : 1
  const grant = placement === 'double' ? Math.max(0, Math.floor(doubleAmount)) : AD_COINS * mult
  const ev: CoinEvent = { type: 'ad', reason: `ad:${placement}`, amount: grant, ts: Date.now() }
  mutate((cur) =>
    trackEarnStreak({
      ...cur,
      balance: cur.balance + grant,
      adCoinsToday: cur.adCoinsToday + grant,
      adsToday: cur.adsToday + 1,
      queue: enqueueEvent(cur.queue, ev),
    })
  )
  return grant
}

/** True while the player can still watch rewarded ads today. */
export function canWatchAd(): boolean {
  return readCoins().adsToday < MAX_ADS_PER_DAY
}

/** Spend coins (cosmetics). Returns false when the balance is insufficient. */
export function spendCoins(amount: number, reason: string): boolean {
  if (amount <= 0) return false
  const s = readCoins()
  if (s.balance < amount) return false
  const ev: CoinEvent = { type: 'spend', reason, amount: -amount, ts: Date.now() }
  mutate((cur) => ({
    ...cur,
    balance: cur.balance - amount,
    queue: enqueueEvent(cur.queue, ev),
  }))
  return true
}

/* ------------------------------ server sync ------------------------------ */

/**
 * Batch-sync unsynced events to the server ledger (claim-then-send so
 * concurrent flushes never double-post). Returns the number synced.
 */
export async function flushCoinEvents(): Promise<number> {
  if (typeof window === 'undefined') return 0
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0
  const s = readCoins()
  if (s.queue.length === 0) return 0

  const events = s.queue
  mutate((cur) => ({ ...cur, queue: [] })) // claim immediately

  try {
    const res = await fetch('/api/coins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getCoinDeviceId(),
        events,
      }),
    })
    if (res.ok) return events.length
    // 4xx = permanently rejected (validation/caps) — drop, never re-queue
    if (res.status >= 400 && res.status < 500) return 0
    throw new Error(`HTTP ${res.status}`)
  } catch {
    // Network/5xx — put the events back at the front (dedupe)
    mutate((cur) => {
      const seen = new Set(cur.queue.map((e) => `${e.type}|${e.reason}|${e.ts}`))
      const restored = events.filter((e) => !seen.has(`${e.type}|${e.reason}|${e.ts}`))
      return { ...cur, queue: [...restored, ...cur.queue].slice(-100) }
    })
    return 0
  }
}

function getCoinDeviceId(): string {
  try {
    let id = window.localStorage.getItem('gz-device-id')
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem('gz-device-id', id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

/** Wire once at app start: flush the coin ledger on load + back-online. */
export function initCoinSync(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const flush = () => {
    void flushCoinEvents()
  }
  flush()
  window.addEventListener('online', flush)
  return () => window.removeEventListener('online', flush)
}

/* ------------------------------ cloud restore (Phase 5) ------------------------------ */

export interface CloudCoins {
  balance: number
  earnStreak: number
  lastEarnDay: string | null
}

/**
 * Merge a cloud backup into the local coin state (used by cloud.ts restore).
 * Honest merge: balances/streaks take the MAX of local vs cloud, the unsynced
 * event queue is never touched, day counters only grow.
 */
export function mergeCloudCoins(cloud: CloudCoins): void {
  if (typeof window === 'undefined') return
  mutate((cur) => ({
    ...cur,
    balance: Math.max(cur.balance, Math.max(0, Math.floor(cloud.balance ?? 0))),
    earnStreak: Math.max(cur.earnStreak, Math.max(0, Math.floor(cloud.earnStreak ?? 0))),
    lastEarnDay: cloud.lastEarnDay ?? cur.lastEarnDay,
  }))
}
