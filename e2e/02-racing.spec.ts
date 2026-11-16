import { test, expect } from '@playwright/test'
import { seed, trackErrors, expectNoErrors, openGame, CARD_ARIA } from './helpers'

/**
 * Turbo Rush — the robot must be able to DRIVE the car on both profiles:
 * touch profile → touch-mode auto-gas accelerates; desktop profile →
 * held ArrowUp accelerates. Then pause/resume/exit all work.
 */

const speed = (page: import('@playwright/test').Page) =>
  page.locator('[data-hud="speed"]')
const timeLeft = (page: import('@playwright/test').Page) =>
  page.locator('[data-hud="time"]')

async function startRace(page: import('@playwright/test').Page) {
  await openGame(page, CARD_ARIA.racing)
  await page.getByRole('button', { name: 'START RACE' }).click()
  /* HUD appears during countdown and stays through playing */
  await expect(speed(page)).toBeVisible()
}

async function raceToHub(page: import('@playwright/test').Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Pause game' }).click()
  } else {
    await page.keyboard.press('p')
  }
  await expect(page.getByText('PAUSED')).toBeVisible()
  await page.getByRole('button', { name: 'EXIT TO HUB' }).click()
  await expect(
    page.getByRole('button', { name: CARD_ARIA.racing }).first()
  ).toBeVisible({ timeout: 10_000 })
}

test.describe('racing', () => {
  test('accelerates on touch (mobile profile)', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile')
    const errs = trackErrors(page)
    await seed(page)
    await startRace(page)

    /* Touch the steer zone (bottom ~76% of screen) — touch mode auto-gases. */
    const vp = page.viewportSize()!
    await page.touchscreen.tap(vp.width * 0.25, vp.height * 0.7)

    await expect
      .poll(async () => Number(await speed(page).textContent()), {
        timeout: 25_000,
        intervals: [250],
      })
      .toBeGreaterThan(0)

    await expect(timeLeft(page)).toBeVisible()

    await raceToHub(page, true)
    expectNoErrors(errs, 'racing touch')
  })

  test('accelerates on held arrow key (desktop profile)', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop')
    const errs = trackErrors(page)
    await seed(page)
    await startRace(page)

    await page.keyboard.down('ArrowUp')

    await expect
      .poll(async () => Number(await speed(page).textContent()), {
        timeout: 25_000,
        intervals: [250],
      })
      .toBeGreaterThan(0)

    await page.keyboard.up('ArrowUp')

    await raceToHub(page, false)
    expectNoErrors(errs, 'racing keyboard')
  })
})
