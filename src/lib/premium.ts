/**
 * Premium tier — Phase 5 (Day 71–90).
 *
 * MANUAL VIP-CODE SYSTEM (zero fee): the owner collects bKash/Nagad payments
 * by hand, issues a VIP code with `bun run vip:new`, and the player redeems
 * it once in the app — this device stays premium from then on.
 *
 * Offline-first: the activation result is cached in localStorage so premium
 * benefits keep working without network. A background re-check syncs the
 * local flag with the server (upgrades on re-activation, downgrades when a
 * code was revoked or the device count was reclaimed).
 *
 * Benefits (enforced across the app):
 *  - 2× daily coins (see coins.ts) with premium-sized server caps
 *  - Instant rewards — rewarded ads are skipped entirely (ad-free)
 *  - Exclusive VIP cars / trails / themes in the shop (cosmetics.ts)
 *  - Car Parking puzzle VIP access (parking-game.tsx, free after FREE_FROM)
 *  - Cloud backup of progress (cloud.ts → Turso `cloud_saves`)
 */

import { useSyncExternalStore } from 'react'
import { getDeviceId } from '@/lib/leaderboard'

/* ------------------------------ constants ------------------------------ */

/** Coin multiplier for premium players (play + flat ad rewards). */
export const PREMIUM_COIN_MULT = 2

/**
 * Car Parking becomes free for everyone after this date (2-week VIP
 * exclusive per the roadmap). ISO date, compared against the local clock.
 */
export const PARKING_FREE_FROM = '2026-11-25'

/** Where buyers should send money / ask for a code — shown in the dialog. */
export const VIP_PAYMENT_NOTE = 'bKash / Nagad — contact the Game Zone admin to get your VIP code'

export type PremiumPlan = 'vip'

export interface PremiumState {
  active: boolean
  plan: PremiumPlan | null
  /** Canonical redeemed code, e.g. GZVIP-AB2C-D3EF */
  code: string | null
  since: number | null
  /** Short restore code (GZC-XXXXXX) — restores progress on a new device */
  cloudCode: string | null
  lastBackupAt: number | null
  verifiedAt: number | null
}

/* ------------------------------ store ------------------------------ */

const STATE_KEY = 'gz-premium'
const listeners = new Set<() => void>()

let snapCache: PremiumState | null = null
let snapKey: string | null = null
let ssrSnapshot: PremiumState | null = null

function getServerSnapshot(): PremiumState {
  if (!ssrSnapshot) ssrSnapshot = defaultState()
  return ssrSnapshot
}

function defaultState(): PremiumState {
  return {
    active: false,
    plan: null,
    code: null,
    since: null,
    cloudCode: null,
    lastBackupAt: null,
    verifiedAt: null,
  }
}

function subscribePremium(cb: () => void): () => void {
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

export function readPremium(): PremiumState {
  if (typeof window === 'undefined') return defaultState()
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STATE_KEY)
  } catch {
    raw = null
  }
  if (snapKey === raw && snapCache) return snapCache
  let parsed: PremiumState
  try {
    parsed = raw ? { ...defaultState(), ...(JSON.parse(raw) as Partial<PremiumState>) } : defaultState()
  } catch {
    parsed = defaultState()
  }
  snapKey = raw
  snapCache = parsed
  return parsed
}

function writePremium(state: PremiumState): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    /* storage blocked — session-only */
  }
  notify()
}

function mutatePremium(fn: (s: PremiumState) => PremiumState): void {
  writePremium(fn(readPremium()))
}

export function usePremium(): PremiumState {
  return useSyncExternalStore(subscribePremium, readPremium, getServerSnapshot)
}

/** Cheap synchronous check for non-React modules (coins, cosmetics, cloud). */
export function isPremiumActive(): boolean {
  return readPremium().active
}

export function setPremiumLocal(patch: Partial<PremiumState>): void {
  mutatePremium((s) => ({ ...s, ...patch }))
}

/* ------------------------------ parking gate ------------------------------ */

/** True once the VIP-exclusive window for Car Parking has ended (date only). */
export function parkingFreeWindowPassed(now = new Date()): boolean {
  const free = new Date(`${PARKING_FREE_FROM}T00:00:00`)
  return !Number.isNaN(free.getTime()) && now.getTime() >= free.getTime()
}

/** VIP-exclusive window: premium OR the free-from date has passed.
 *  NOTE for React SSR: prefer `premium.active` from usePremium() +
 *  `parkingFreeWindowPassed()` in server-rendered components — calling this
 *  directly in render reads localStorage and causes hydration mismatches. */
export function canPlayParking(now = new Date()): boolean {
  if (isPremiumActive()) return true
  return parkingFreeWindowPassed(now)
}

/* ------------------------------ redeem ------------------------------ */

/** Canonicalize a typed code: strips separators, uppercases, re-formats. */
export function canonicalVipCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const m = /^GZVIP([A-HJ-NP-Z2-9]{8})$/.exec(raw)
  if (!m) return null
  const body = m[1]
  return `GZVIP-${body.slice(0, 4)}-${body.slice(4)}`
}

export type RedeemResult =
  | { ok: true; plan: PremiumPlan; cloudCode: string }
  | { ok: false; reason: 'invalid' | 'limit' | 'offline' | 'error' }

/**
 * Redeem a VIP code for this device. On success the activation is cached
 * locally and VIP cosmetics are granted automatically.
 */
export async function redeemPremium(input: string): Promise<RedeemResult> {
  const code = canonicalVipCode(input)
  if (!code) return { ok: false, reason: 'invalid' }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, reason: 'offline' }

  try {
    const res = await fetch('/api/premium/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, deviceId: getDeviceId() }),
    })
    if (res.status === 404) return { ok: false, reason: 'invalid' }
    if (res.status === 409) return { ok: false, reason: 'limit' }
    if (!res.ok) return { ok: false, reason: 'error' }
    const data = (await res.json()) as { plan?: string; cloudCode?: string }
    const plan: PremiumPlan = data.plan === 'vip' ? 'vip' : 'vip'
    activatePremiumLocally(code, plan, data.cloudCode ?? null)
    return { ok: true, plan, cloudCode: data.cloudCode ?? '' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** Cache the activation + auto-grant VIP cosmetics. */
function activatePremiumLocally(code: string, plan: PremiumPlan, cloudCode: string | null): void {
  mutatePremium((s) => ({
    ...s,
    active: true,
    plan,
    code,
    since: s.since ?? Date.now(),
    cloudCode: s.cloudCode ?? cloudCode,
    verifiedAt: Date.now(),
  }))
  // Dynamic import avoids a hard cycle cosmetics → premium → cosmetics
  void import('@/lib/cosmetics').then((m) => m.grantPremiumCosmetics())
}

/* ------------------------------ server verification ------------------------------ */

export type VerifyOutcome = 'premium' | 'inactive' | 'offline' | 'error'

/**
 * Re-check the device's premium status with the server and reconcile the
 * local flag. Keeps premium working offline — a failed check never strips
 * the local activation.
 */
export async function verifyPremium(): Promise<VerifyOutcome> {
  const local = readPremium()
  if (!local.active) return 'inactive'
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'
  try {
    const res = await fetch(`/api/premium/status?device=${encodeURIComponent(getDeviceId())}`)
    if (!res.ok) return 'error'
    const data = (await res.json()) as { premium: boolean; plan?: string; cloudCode?: string | null }
    if (data.premium) {
      mutatePremium((s) => ({
        ...s,
        active: true,
        plan: 'vip',
        verifiedAt: Date.now(),
        cloudCode: s.cloudCode ?? data.cloudCode ?? null,
      }))
      return 'premium'
    }
    // Server says this device is not premium anymore (revoked / device slot
    // reclaimed). Keep cosmetic state but drop the premium flag.
    setPremiumLocal({ active: false, plan: null, code: null })
    return 'inactive'
  } catch {
    return 'error'
  }
}

/** Wire once at app start: verify on load + whenever the connection returns. */
export function initPremiumSync(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const check = () => {
    void verifyPremium()
  }
  check()
  window.addEventListener('online', check)
  return () => window.removeEventListener('online', check)
}
