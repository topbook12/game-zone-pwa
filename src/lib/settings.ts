/**
 * Global player settings — one store, every game (Phase 2, Day 16–17).
 *
 * Stored as a single JSON blob in localStorage (`gz-settings`) and shared
 * reactively via useSyncExternalStore (same hydration-safe pattern as i18n).
 *
 - `sound`     — master audio switch (games that synthesize audio read this)
 * - `haptics`  — vibration feedback on supported phones
 * - `dataSaver`— low-graphics mode (3D racing drops draw distance/DPR/particles)
 */

import { useSyncExternalStore } from 'react'

export interface GameSettings {
  sound: boolean
  haptics: boolean
  dataSaver: boolean
}

const DEFAULTS: GameSettings = { sound: true, haptics: true, dataSaver: false }

const KEY = 'gz-settings'

const listeners = new Set<() => void>()

function parse(raw: string | null): GameSettings {
  if (!raw) return { ...DEFAULTS }
  try {
    const obj = JSON.parse(raw) as Partial<GameSettings>
    return {
      sound: typeof obj.sound === 'boolean' ? obj.sound : DEFAULTS.sound,
      haptics: typeof obj.haptics === 'boolean' ? obj.haptics : DEFAULTS.haptics,
      dataSaver: typeof obj.dataSaver === 'boolean' ? obj.dataSaver : DEFAULTS.dataSaver,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function read(): GameSettings {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === cachedRaw) return cached
    cached = parse(raw)
    cachedRaw = raw
    return cached
  } catch {
    return DEFAULTS
  }
}

/* Snapshot caching — useSyncExternalStore requires a STABLE snapshot object
 * between renders, otherwise React warns (and can loop) on every call. */
let cached: GameSettings = DEFAULTS
let cachedRaw: string | null = null

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

/** Non-reactive read for engine/game-loop code that must not re-render. */
export function readSettings(): GameSettings {
  return read()
}

export function updateSettings(patch: Partial<GameSettings>): void {
  if (typeof window === 'undefined') return
  try {
    const next = { ...read(), ...patch }
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked — ignore */
  }
  // Invalidate the snapshot cache BEFORE notifying, so subscribers read fresh.
  cachedRaw = null
  listeners.forEach((l) => l())
}

/** Reactive hook — SSR returns the shared defaults object (stable, cached). */
export function useSettings(): GameSettings {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS)
}

/** Keys that survive a progress reset (device preferences, not progress). */
const KEEP = new Set(['gz-lang', 'gz-settings', 'gz-welcome', 'gz-device-id'])

/**
 * Erase every local progress key (scores, coins, badges, cosmetics, VIP,
 * profile, sync queue). Device-level preferences survive.
 * Returns how many keys were removed (0 also fine).
 */
export function resetProgress(): number {
  if (typeof window === 'undefined') return 0
  let removed = 0
  try {
    const doomed: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith('gz-') && !KEEP.has(k)) doomed.push(k)
    }
    doomed.forEach((k) => {
      window.localStorage.removeItem(k)
      removed++
    })
  } catch {
    return removed
  }
  // Scores/coins read via useStoredNumber/coins store — wake them up.
  cachedRaw = null
  listeners.forEach((l) => l())
  return removed
}
