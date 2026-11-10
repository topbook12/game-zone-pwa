/**
 * Player profile — avatar, referral code, weekly crowns (Phase 3, Day 26–45).
 *
 * Everything lives in localStorage (zero server cost); the only network calls
 * are the tiny referral count endpoint and weekly leaderboard reads that the
 * profile dialog triggers while open.
 */

import { readStoredNumber, writeStoredNumber, notifyStoreChange, STORAGE_KEYS } from '@/lib/game-store'
import { getDeviceId, type GameId } from '@/lib/leaderboard'
import { unlockedCount, achievementsTotal } from '@/lib/achievements'
import { weekKey } from '@/lib/tournament'

/* ------------------------------ avatar ------------------------------ */

export const AVATARS = [
  '🎮', '🏎️', '🧠', '🐍', '🎯', '👑', '🚀', '🔥',
  '⭐', '🦁', '⚡', '💎', '🥷', '🧿', '🦅', '🇧🇩',
] as const

const AVATAR_KEY = 'gz-avatar'

export function getAvatar(): string {
  if (typeof window === 'undefined') return '🎮'
  try {
    const a = window.localStorage.getItem(AVATAR_KEY)
    return (a && (AVATARS as readonly string[]).includes(a) ? a : '🎮')
  } catch {
    return '🎮'
  }
}

export function setAvatar(emoji: string): void {
  try {
    window.localStorage.setItem(AVATAR_KEY, emoji)
  } catch {
    /* ignore */
  }
  notifyStoreChange()
}

/* ------------------------------ referral ------------------------------ */

/** Stable, URL-safe invite code derived from this device's id (8 chars). */
export function getRefCode(): string {
  const id = getDeviceId().replace(/[^a-z0-9]/gi, '').toLowerCase()
  return id.slice(0, 8) || 'player1'
}

const REF_BY_KEY = 'gz-ref-by'
const REF_SENT_KEY = 'gz-ref-sent'

/** Who invited this player (set from a ?ref= link), if any. */
export function getReferrer(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(REF_BY_KEY)
  } catch {
    return null
  }
}

/**
 * Capture `?ref=code` from the URL exactly once per device, register it on the
 * server, then strip the param so the address bar stays clean. Safe to call on
 * every mount — all branches are idempotent.
 */
export async function captureReferral(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('ref')
    if (!raw) return

    const ref = raw.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 16)
    if (ref.length >= 4 && ref !== getRefCode()) {
      window.localStorage.setItem(REF_BY_KEY, ref)
      if (!window.localStorage.getItem(REF_SENT_KEY) && typeof navigator !== 'undefined' && navigator.onLine) {
        window.localStorage.setItem(REF_SENT_KEY, '1')
        try {
          await fetch('/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref, deviceId: getDeviceId() }),
          })
        } catch {
          /* offline or failed — link is still stored locally */
        }
      }
    }

    // Strip ?ref so shared URLs look clean
    params.delete('ref')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
  } catch {
    /* ignore */
  }
}

/** How many friends have joined through this player's invite link. */
export async function getInvitedCount(): Promise<number> {
  try {
    const res = await fetch(`/api/referral?ref=${encodeURIComponent(getRefCode())}`)
    if (!res.ok) return 0
    const data = (await res.json()) as { count?: number }
    return typeof data.count === 'number' ? data.count : 0
  } catch {
    return 0
  }
}

/* ------------------------------ weekly crowns ------------------------------ */

const WINS_KEY = 'gz-week-wins'

export function getWeeklyWins(): number {
  return readStoredNumber(WINS_KEY, 0)
}

/** Record a weekly #1 finish — at most once per game per ISO week. */
export function bumpWeeklyWin(game: GameId): void {
  if (typeof window === 'undefined') return
  try {
    const marker = `gz-week-win-${game}-${weekKey()}`
    if (window.localStorage.getItem(marker)) return
    window.localStorage.setItem(marker, '1')
    writeStoredNumber(WINS_KEY, readStoredNumber(WINS_KEY, 0) + 1)
  } catch {
    /* ignore */
  }
}

/* ------------------------------ profile stats ------------------------------ */

/** Best quiz score across every category (gz-quiz-best-* keys). */
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

export interface ProfileStats {
  plays: number
  achievementsUnlocked: number
  achievementsTotal: number
  weeklyWins: number
  bests: Record<GameId, number>
}

/** Snapshot of everything the profile card shows (client only). */
export function getProfileStats(): ProfileStats {
  return {
    plays: readStoredNumber(STORAGE_KEYS.plays, 0),
    achievementsUnlocked: unlockedCount(),
    achievementsTotal: achievementsTotal(),
    weeklyWins: getWeeklyWins(),
    bests: {
      racing: readStoredNumber(STORAGE_KEYS.racingBest, 0),
      quiz: bestQuizScore(),
      g2048: readStoredNumber(STORAGE_KEYS.g2048Best, 0),
      snake: readStoredNumber(STORAGE_KEYS.snakeBest, 0),
      parking: readStoredNumber('gz-parking-best', 0),
    },
  }
}
