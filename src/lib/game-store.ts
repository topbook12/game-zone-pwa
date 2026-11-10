/**
 * localStorage helpers for game stats, reactive across components
 * (React 19 useSyncExternalStore based, hydration safe).
 */

import { useSyncExternalStore } from 'react'

const storageListeners = new Set<() => void>()

function subscribeStorage(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  storageListeners.add(callback)
  window.addEventListener('storage', callback)
  return () => {
    storageListeners.delete(callback)
    window.removeEventListener('storage', callback)
  }
}

function notifyStorage(): void {
  storageListeners.forEach((listener) => listener())
}

/** Manually notify store subscribers (e.g. after writing a string key). */
export function notifyStoreChange(): void {
  if (typeof window === 'undefined') return
  notifyStorage()
}

/** Read a number from localStorage (fallback when missing/SSR). */
export function readStoredNumber(key: string, fallback = 0): number {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return Number(raw) || fallback
  } catch {
    return fallback
  }
}

/** Save a number to localStorage and notify subscribers. */
export function writeStoredNumber(key: string, value: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, String(value))
    notifyStorage()
  } catch {
    /* storage full/blocked — ignore */
  }
}

/** Reactively read a number inside components (SSR returns fallback). */
export function useStoredNumber(key: string, fallback = 0): number {
  return useSyncExternalStore(
    subscribeStorage,
    () => readStoredNumber(key, fallback),
    () => fallback
  )
}

/** Shared localStorage keys used across games. */
export const STORAGE_KEYS = {
  plays: 'gz-plays',
  racingBest: 'gz-racing-best',
  quizBest: (category: string) => `gz-quiz-best-${category}`,
  g2048Best: 'gz-g2048-best',
  g2048Tile: 'gz-g2048-tile',
  snakeBest: 'gz-snake-best',
} as const
