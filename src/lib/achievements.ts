/**
 * Achievements — localStorage badges with bilingual titles (Phase 2).
 *
 * Zero server cost: stats already live in localStorage from the games.
 * `checkAchievements()` is called by every game right after it stores its
 * result — newly unlocked badges pop up as sonner toasts automatically.
 */

import { toast } from 'sonner'
import { readStoredNumber, STORAGE_KEYS } from '@/lib/game-store'
import { getStreak, getDailyCompletions } from '@/lib/daily'
import type { Lang } from '@/lib/i18n'

const STORE_KEY = 'gz-achievements'

export type AchievementId =
  | 'first_play'
  | 'plays_10'
  | 'plays_50'
  | 'racing_5k'
  | 'racing_20k'
  | 'quiz_1000'
  | 'tile_512'
  | 'tile_2048'
  | 'snake_200'
  | 'snake_500'
  | 'daily_1'
  | 'daily_streak_3'
  | 'daily_streak_7'
  | 'top10'

interface AchievementDef {
  id: AchievementId
  emoji: string
  title: Record<Lang, string>
  desc: Record<Lang, string>
  goal: number // 0 → boolean milestone
  current: () => number
}

/** Best quiz score across every category prefix. */
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

const DEFS: AchievementDef[] = [
  {
    id: 'first_play',
    emoji: '🎮',
    title: { en: 'First Play', bn: 'প্রথম খেলা' },
    desc: { en: 'Play your very first game', bn: 'আপনার প্রথম গেম খেলুন' },
    goal: 1,
    current: () => readStoredNumber(STORAGE_KEYS.plays),
  },
  {
    id: 'plays_10',
    emoji: '🕹️',
    title: { en: 'Warmed Up', bn: 'উষ্ণ হয়ে উঠছি' },
    desc: { en: 'Play 10 games', bn: '১০টি গেম খেলুন' },
    goal: 10,
    current: () => readStoredNumber(STORAGE_KEYS.plays),
  },
  {
    id: 'plays_50',
    emoji: '🏅',
    title: { en: 'Regular Player', bn: 'নিয়মিত খেলোয়াড়' },
    desc: { en: 'Play 50 games', bn: '৫০টি গেম খেলুন' },
    goal: 50,
    current: () => readStoredNumber(STORAGE_KEYS.plays),
  },
  {
    id: 'racing_5k',
    emoji: '🏎️',
    title: { en: 'Speed Rookie', bn: 'স্পিড রুকি' },
    desc: { en: 'Score 5,000 in Turbo Rush', bn: 'Turbo Rush-এ ৫,০০০ স্কোর করুন' },
    goal: 5000,
    current: () => readStoredNumber(STORAGE_KEYS.racingBest),
  },
  {
    id: 'racing_20k',
    emoji: '🚀',
    title: { en: 'Nitro Legend', bn: 'নাইট্রো লিজেন্ড' },
    desc: { en: 'Score 20,000 in Turbo Rush', bn: 'Turbo Rush-এ ২০,০০০ স্কোর করুন' },
    goal: 20000,
    current: () => readStoredNumber(STORAGE_KEYS.racingBest),
  },
  {
    id: 'quiz_1000',
    emoji: '🧠',
    title: { en: 'Brainbox', bn: 'মেধাবী' },
    desc: { en: 'Score 1,000 in any quiz run', bn: 'যেকোনো কুইজে ১,০০০ স্কোর করুন' },
    goal: 1000,
    current: bestQuizScore,
  },
  {
    id: 'tile_512',
    emoji: '🎯',
    title: { en: 'Fusion Master', bn: 'ফিউশন মাস্টার' },
    desc: { en: 'Merge a 512 tile in 2048', bn: '2048-এ 512 টাইল বানান' },
    goal: 512,
    current: () => readStoredNumber(STORAGE_KEYS.g2048Tile),
  },
  {
    id: 'tile_2048',
    emoji: '👑',
    title: { en: 'The Golden Tile', bn: 'সোনালি টাইল' },
    desc: { en: 'Create the legendary 2048 tile', bn: 'কিংবদন্তি 2048 টাইল বানান' },
    goal: 2048,
    current: () => readStoredNumber(STORAGE_KEYS.g2048Tile),
  },
  {
    id: 'snake_200',
    emoji: '🐍',
    title: { en: 'Neon Rookie', bn: 'নিয়ন রুকি' },
    desc: { en: 'Score 200 in Snake Neon', bn: 'Snake Neon-এ 200 স্কোর করুন' },
    goal: 200,
    current: () => readStoredNumber(STORAGE_KEYS.snakeBest),
  },
  {
    id: 'snake_500',
    emoji: '⚡',
    title: { en: 'Serpent King', bn: 'সর্প রাজা' },
    desc: { en: 'Score 500 in Snake Neon', bn: 'Snake Neon-এ 500 স্কোর করুন' },
    goal: 500,
    current: () => readStoredNumber(STORAGE_KEYS.snakeBest),
  },
  {
    id: 'daily_1',
    emoji: '📅',
    title: { en: 'Daily Starter', bn: 'ডেইলি শুরু' },
    desc: { en: 'Complete your first daily challenge', bn: 'প্রথম ডেইলি চ্যালেঞ্জ সম্পন্ন করুন' },
    goal: 1,
    current: () => getDailyCompletions(),
  },
  {
    id: 'daily_streak_3',
    emoji: '🔥',
    title: { en: 'On Fire', bn: 'আগুনের স্ট্রিক' },
    desc: { en: 'Play the daily challenge 3 days in a row', bn: '৩ দিন টানা ডেইলি চ্যালেঞ্জ খেলুন' },
    goal: 3,
    current: () => getStreak(),
  },
  {
    id: 'daily_streak_7',
    emoji: '💥',
    title: { en: 'Unstoppable', bn: 'থামানো অসম্ভব' },
    desc: { en: 'Play the daily challenge 7 days in a row', bn: '৭ দিন টানা ডেইলি চ্যালেঞ্জ খেলুন' },
    goal: 7,
    current: () => getStreak(),
  },
  {
    id: 'top10',
    emoji: '🏆',
    title: { en: 'World Class', bn: 'বিশ্বমানের' },
    desc: { en: 'Reach the global top 10 in any game', bn: 'যেকোনো গেমে গ্লোবাল টপ 10-এ পৌঁছান' },
    goal: 0,
    current: () => 0,
  },
]

export interface Achievement {
  id: AchievementId
  emoji: string
  title: string
  desc: string
  unlockedAt: number | null
  progress: number // 0..1 (1 = unlocked; boolean achievements are 0 or 1)
  goal: number
  current: number
}

function readStore(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, number>): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

/** Unlock a specific achievement (e.g. leaderboard top-10 from submit result). */
export function unlockAchievement(id: AchievementId, lang: Lang = 'en'): boolean {
  const store = readStore()
  if (store[id]) return false
  store[id] = Date.now()
  writeStore(store)
  const def = DEFS.find((d) => d.id === id)
  if (def) {
    toast(`${def.emoji} ${def.title[lang]}`, { description: def.desc[lang] })
  }
  return true
}

/** Called by games after stats are stored — returns ids unlocked this call. */
export function checkAchievements(lang: Lang = 'en'): AchievementId[] {
  const store = readStore()
  const fresh: AchievementId[] = []
  for (const def of DEFS) {
    if (store[def.id]) continue
    const cur = def.current()
    const reached = def.goal === 0 ? false : cur >= def.goal
    if (reached) {
      store[def.id] = Date.now()
      fresh.push(def.id)
      toast(`${def.emoji} ${def.title[lang]}`, { description: def.desc[lang] })
    }
  }
  if (fresh.length > 0) writeStore(store)
  return fresh
}

/** Full list for the dialog (reactive callers should re-read on open). */
export function getAchievements(lang: Lang): Achievement[] {
  const store = readStore()
  return DEFS.map((def) => {
    const at = store[def.id] ?? null
    const cur = def.current()
    const progress = at !== null ? 1 : def.goal > 0 ? Math.min(1, cur / def.goal) : 0
    return {
      id: def.id,
      emoji: def.emoji,
      title: def.title[lang],
      desc: def.desc[lang],
      unlockedAt: at,
      progress,
      goal: def.goal,
      current: cur,
    }
  })
}

export function unlockedCount(): number {
  return Object.keys(readStore()).length
}

/** Total number of defined achievements (for "x/14" progress labels). */
export function achievementsTotal(): number {
  return DEFS.length
}
