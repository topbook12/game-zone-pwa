import type { Page } from '@playwright/test'

/**
 * Shared robots' toolkit (Phase 3).
 *
 * Every test plays as a fresh visitor with the noisy overlays pre-dismissed:
 * welcome tour done, sound/haptics off (CI runners have no audio), data-saver
 * on (matches low-end phones), and every /api/* call aborted so the suite is
 * hermetic AND simultaneously proves the offline-first promise.
 */

export const CARD_ARIA = {
  racing: 'Play Turbo Rush',
  quiz: 'Play Brain Quiz',
  g2048: 'Play 2048 Fusion',
  snake: 'Play Snake Neon',
  parking: 'Play Car Parking',
} as const

/** Pre-seed localStorage before any app script runs. */
export async function seed(page: Page, opts?: { premium?: boolean }) {
  await page.addInitScript(
    ({ premium }) => {
      try {
        localStorage.setItem('gz-welcome', 'done')
        localStorage.setItem('gz-lang', 'en')
        localStorage.setItem(
          'gz-settings',
          JSON.stringify({ sound: false, haptics: false, dataSaver: true })
        )
        if (premium) {
          localStorage.setItem(
            'gz-premium',
            JSON.stringify({
              active: true,
              plan: 'vip',
              code: 'GZVIP-TEST-CI01',
              since: Date.now(),
              cloudCode: null,
              lastBackupAt: null,
              verifiedAt: Date.now(),
            })
          )
        }
      } catch {
        /* storage blocked — tests will surface it */
      }
    },
    { premium: opts?.premium ?? false }
  )

  /* Hermetic + offline-first proof: the UI must survive every API failing. */
  await page.route('**/api/**', (route) => route.abort())
}

/** Collect uncaught page errors + console errors. Returns a finish() checker. */
export function trackErrors(page: Page): () => string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  return () =>
    errors.filter(
      (e) =>
        !/Download the React DevTools|\[Fast Refresh\]|hmr/i.test(e) &&
        /* net::ERR_FAILED is the browser logging OUR intentional /api/* blackout
         * (hermetic offline test) — the app catching it silently is the point. */
        !/net::ERR_FAILED/.test(e)
    )
}

/** Throw with a readable digest if the robots caught any errors. */
export function expectNoErrors(collect: () => string[], context: string) {
  const errs = collect()
  if (errs.length > 0) {
    throw new Error(
      `Robot found ${errs.length} error(s) [${context}]:\n  - ${errs.join('\n  - ')}`
    )
  }
}

/** Open the hub and launch a game via its card. */
export async function openGame(page: Page, cardAria: string) {
  await page.goto('/')
  await page.getByRole('button', { name: cardAria }).first().click()
}

/**
 * Pointer swipe over an element — dispatches pointerdown/move/up so both
 * pointer and touch-derived handlers see the gesture (same gesture path a
 * finger takes on a real phone).
 */
export async function swipe(
  page: Page,
  selector: string,
  dir: 'left' | 'right' | 'up' | 'down'
) {
  await page
    .locator(selector)
    .first()
    .evaluate(
      (el, dir) => {
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dirs: Record<string, [number, number]> = {
          left: [-90, 0],
          right: [90, 0],
          up: [0, -90],
          down: [0, 90],
        }
        const delta = dirs[dir]
        const init: PointerEventInit = {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          buttons: 1,
        }
        el.dispatchEvent(
          new PointerEvent('pointerdown', { ...init, clientX: cx, clientY: cy })
        )
        el.dispatchEvent(
          new PointerEvent('pointermove', {
            ...init,
            clientX: cx + delta[0],
            clientY: cy + delta[1],
          })
        )
        el.dispatchEvent(
          new PointerEvent('pointerup', {
            ...init,
            buttons: 0,
            clientX: cx + delta[0],
            clientY: cy + delta[1],
          })
        )
      },
      dir
    )
}

/** Back to the hub from any game via its "Back to game hub" button. */
export async function backToHub(page: Page) {
  await page.getByRole('button', { name: 'Back to game hub' }).click()
  await page.getByRole('heading', { name: 'Game Zone', level: 1 }).waitFor()
}
