import { test, expect } from '@playwright/test'
import { seed, trackErrors, expectNoErrors, openGame, swipe, CARD_ARIA } from './helpers'

/**
 * Snake Neon — walls kill (no wrap), so a started run ALWAYS ends in
 * GAME OVER. The robot steers mid-run (D-pad on touch, arrow keys on
 * desktop), survives the game-over screen and plays a second round.
 */

const APP = '[role="application"][aria-label="Snake Neon arcade game"]'
const WRAP = `${APP} div.relative.aspect-square div.absolute.inset-0`

test.describe('snake', () => {
  test('run → steer → game over → play again (both profiles)', async ({ page }) => {
    const isMobile = test.info().project.name === 'mobile'
    const errs = trackErrors(page)
    await seed(page)
    await openGame(page, CARD_ARIA.snake)

    await expect(page.locator(APP)).toBeVisible()
    await page.getByRole('button', { name: 'START', exact: true }).click()

    /* Steer mid-run: swipe surface + D-pad on touch, keys on desktop */
    if (isMobile) {
      await swipe(page, WRAP, 'up')
      await page.getByRole('button', { name: 'Steer left' }).click()
    } else {
      await page.keyboard.press('ArrowLeft')
    }

    await expect(page.getByText('GAME OVER')).toBeVisible({ timeout: 40_000 })

    await page.getByRole('button', { name: 'PLAY AGAIN' }).click()
    await expect(page.locator(APP)).toBeVisible()

    if (isMobile) {
      await page.getByRole('button', { name: 'Steer down' }).click()
    } else {
      await page.keyboard.press('ArrowDown')
    }

    await expect(page.getByText('GAME OVER')).toBeVisible({ timeout: 40_000 })

    expectNoErrors(errs, 'snake lifecycle')
  })
})
