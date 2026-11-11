/**
 * Rewarded ads — Phase 4 (Day 46–70).
 *
 * HONEST MONETIZATION: players always see what they get, and ads are 100%
 * opt-in. This module is the network-agnostic layer:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Game UI → showRewardedAd(placement) → adapter → reward      │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * The ACTIVE adapter is `demoAdapter` — a clearly-labeled placeholder player
 * so the whole flow works today with zero cost. When the ad network account
 * is ready (AdSense H5 Games / AdMob via TWA / StartApp web), implement
 * `RewardedAdapter` and flip ACTIVE_ADAPTER — nothing else changes.
 *
 * Placements: 'coins' (+25), 'nitro' (+25 & +2 nitro next race),
 * 'lifeline' (+25 & +1 lifeline), 'double' (doubles the play reward).
 * Every completed ad counts against the shared 10/day cap (see coins.ts).
 */

import { canWatchAd, grantAdReward, MAX_ADS_PER_DAY, readCoins } from '@/lib/coins'

export type AdPlacement = 'coins' | 'nitro' | 'lifeline' | 'double'

export type AdResult = 'completed' | 'abandoned' | 'capped'

export interface RewardedAdapter {
  readonly name: string
  /** Show an ad; resolves 'completed' only when the reward was fully earned. */
  show(placement: AdPlacement): Promise<'completed' | 'abandoned'>
}

/** Placeholder adapter — an honest, labeled demo interstitial.
 *  The UI player lives in `rewarded-ad-dialog.tsx` which drives this promise. */
let resolver: ((r: 'completed' | 'abandoned') => void) | null = null

export const demoAdapter: RewardedAdapter = {
  name: 'demo',
  show(): Promise<'completed' | 'abandoned'> {
    return new Promise((resolve) => {
      resolver = resolve
    })
  },
}

/** Internal — called by the demo ad player dialog when it finishes. */
export function _resolveDemoAd(result: 'completed' | 'abandoned'): void {
  resolver?.(result)
  resolver = null
}

const ACTIVE_ADAPTER: RewardedAdapter = demoAdapter

/**
 * Show a rewarded ad through the active adapter.
 * Resolves 'capped' without showing anything when the daily limit is hit.
 * NOTE: coins are granted by the caller via `finishAdReward()` AFTER a
 * 'completed' result, so the UI can show the reward where it belongs.
 */
export async function showRewardedAd(placement: AdPlacement): Promise<AdResult> {
  if (!canWatchAd()) return 'capped'
  return ACTIVE_ADAPTER.show(placement)
}

/** Grant the reward for a completed ad (counts against the daily cap). */
export function finishAdReward(placement: AdPlacement, doubleAmount = 0): number {
  return grantAdReward(placement, doubleAmount)
}

/** Info for UI labels: ads remaining today. */
export function adsRemainingToday(): number {
  return Math.max(0, MAX_ADS_PER_DAY - readCoins().adsToday)
}
