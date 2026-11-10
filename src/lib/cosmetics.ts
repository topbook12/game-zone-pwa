/**
 * Cosmetics — pure client skins (Phase 4 Day 46–70).
 *
 * Zero server cost by design: ownership + selection live in localStorage,
 * prices are paid with the local coin balance, and every category has one
 * free default so nobody is forced to pay to look normal.
 */

import { useSyncExternalStore } from 'react'

export type CosmeticCategory = 'car' | 'trail' | 'theme'

export interface CosmeticItem {
  id: string
  category: CosmeticCategory
  name: string
  nameBn: string
  price: number
  /** main paint color (car) or accent (trail) */
  color?: string
  /** glow color used by trails */
  glow?: string
  /** hue-cycle flag for the rainbow trail */
  rainbow?: boolean
  /** quiz theme background gradient */
  from?: string
  to?: string
}

export const COSMETICS: CosmeticItem[] = [
  /* ---- car colors ---- */
  { id: 'car-default', category: 'car', name: 'Crimson', nameBn: 'ক্রিমসন', price: 0, color: '#e11d48' },
  { id: 'car-sunburst', category: 'car', name: 'Sunburst', nameBn: 'সানবার্স্ট', price: 300, color: '#f59e0b' },
  { id: 'car-lime', category: 'car', name: 'Lime Rocket', nameBn: 'লাইম রকেট', price: 300, color: '#84cc16' },
  { id: 'car-mint', category: 'car', name: 'Mint Flash', nameBn: 'মিন্ট ফ্ল্যাশ', price: 450, color: '#14b8a6' },
  { id: 'car-violet', category: 'car', name: 'Violet Storm', nameBn: 'ভায়োলেট স্টর্ম', price: 600, color: '#a855f7' },
  { id: 'car-gold', category: 'car', name: 'Gold King', nameBn: 'গোল্ড কিং', price: 900, color: '#fbbf24' },
  /* ---- trails ---- */
  { id: 'trail-none', category: 'trail', name: 'No trail', nameBn: 'ট্রেইল নেই', price: 0 },
  { id: 'trail-ember', category: 'trail', name: 'Ember', nameBn: 'এম্বার', price: 400, color: '#f97316', glow: '#fb923c' },
  { id: 'trail-toxic', category: 'trail', name: 'Toxic', nameBn: 'টক্সিক', price: 450, color: '#a3e635', glow: '#bef264' },
  { id: 'trail-neon', category: 'trail', name: 'Neon', nameBn: 'নিয়ন', price: 500, color: '#22d3ee', glow: '#67e8f9' },
  { id: 'trail-rainbow', category: 'trail', name: 'Rainbow', nameBn: 'রেইনবো', price: 900, color: '#f472b6', glow: '#f472b6', rainbow: true },
  /* ---- quiz themes ---- */
  { id: 'theme-default', category: 'theme', name: 'Classic Dark', nameBn: 'ক্লাসিক ডার্ক', price: 0, from: '#1c1917', to: '#292524' },
  { id: 'theme-ember', category: 'theme', name: 'Ember', nameBn: 'এম্বার', price: 300, from: '#431407', to: '#1c1917' },
  { id: 'theme-forest', category: 'theme', name: 'Forest', nameBn: 'ফরেস্ট', price: 300, from: '#052e16', to: '#0f172a' },
  { id: 'theme-orchid', category: 'theme', name: 'Orchid', nameBn: 'অর্কিড', price: 450, from: '#4a044e', to: '#18181b' },
]

export const DEFAULT_OWNED = ['car-default', 'trail-none', 'theme-default']

export interface CosmeticState {
  owned: string[]
  car: string
  trail: string
  theme: string
}

const STATE_KEY = 'gz-cosmetics'
const listeners = new Set<() => void>()

/* Snapshot cache — see coins.ts: useSyncExternalStore needs a stable
 * getSnapshot result between store changes. */
let snapCache: CosmeticState | null = null
let snapKey: string | null = null
let ssrSnapshot: CosmeticState | null = null

/** Stable server snapshot — React requires a cached reference here too. */
function getServerSnapshot(): CosmeticState {
  if (!ssrSnapshot) ssrSnapshot = defaultState()
  return ssrSnapshot
}

function defaultState(): CosmeticState {
  return { owned: [...DEFAULT_OWNED], car: 'car-default', trail: 'trail-none', theme: 'theme-default' }
}

function subscribe(cb: () => void): () => void {
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

export function readCosmetics(): CosmeticState {
  if (typeof window === 'undefined') return defaultState()
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STATE_KEY)
  } catch {
    raw = null
  }
  if (snapKey === raw && snapCache) return snapCache
  let parsed: CosmeticState
  try {
    parsed = raw ? { ...defaultState(), ...(JSON.parse(raw) as Partial<CosmeticState>) } : defaultState()
  } catch {
    parsed = defaultState()
  }
  snapKey = raw
  snapCache = parsed
  return parsed
}

function writeCosmetics(state: CosmeticState): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  notify()
}

export function useCosmetics(): CosmeticState {
  return useSyncExternalStore(subscribe, readCosmetics, getServerSnapshot)
}

export function getCosmetic(id: string): CosmeticItem | undefined {
  return COSMETICS.find((c) => c.id === id)
}

/** Resolve the equipped car paint (falls back to default). */
export function getCarColor(state = readCosmetics()): string {
  return getCosmetic(state.car)?.color ?? '#e11d48'
}

/** Resolve the equipped trail (falls back to none). */
export function getTrail(state = readCosmetics()): CosmeticItem {
  return getCosmetic(state.trail) ?? getCosmetic('trail-none')!
}

/** Resolve the equipped quiz theme gradient (falls back to default). */
export function getTheme(state = readCosmetics()): CosmeticItem {
  return getCosmetic(state.theme) ?? getCosmetic('theme-default')!
}

export type BuyResult = { ok: true } | { ok: false; reason: 'missing' | 'owned' | 'funds' }

/** Buy a cosmetic with coins. Marks owned + auto-selects it on success. */
export function buyCosmetic(id: string, spend: (amount: number, reason: string) => boolean): BuyResult {
  const item = getCosmetic(id)
  if (!item) return { ok: false, reason: 'missing' }
  const state = readCosmetics()
  if (state.owned.includes(id)) return { ok: false, reason: 'owned' }
  if (item.price > 0 && !spend(item.price, `shop:${id}`)) return { ok: false, reason: 'funds' }
  const next: CosmeticState = { ...state, owned: [...state.owned, id] }
  if (item.category === 'car') next.car = id
  else if (item.category === 'trail') next.trail = id
  else next.theme = id
  writeCosmetics(next)
  return { ok: true }
}

/** Select an already-owned item. */
export function selectCosmetic(id: string): boolean {
  const item = getCosmetic(id)
  if (!item) return false
  const state = readCosmetics()
  if (!state.owned.includes(id)) return false
  if (item.category === 'car') writeCosmetics({ ...state, car: id })
  else if (item.category === 'trail') writeCosmetics({ ...state, trail: id })
  else writeCosmetics({ ...state, theme: id })
  return true
}
