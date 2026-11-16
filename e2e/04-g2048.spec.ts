import { test, expect, type Page } from '@playwright/test'
import { seed, trackErrors, expectNoErrors, openGame, swipe, CARD_ARIA } from './helpers'

/**
 * 2048 Fusion — the robot must be able to MOVE THE BOARD:
 * touch profile → pointer swipe; desktop profile → arrow keys.
 * A valid move always spawns exactly one new tile, so tile count grows.
 */

const BOARD = '[role="application"][aria-label="2048 Fusion puzzle game"] div.touch-none'

async function tileCount(page: Page): Promise<number> {
  return page
    .locator(`${BOARD} div.absolute.left-0.top-0`)
    .count()
}

async function makeMove(page: Page, isMobile: boolean, dir: 'left' | 'up' | 'down') {
  if (isMobile) {
    await swipe(page, BOARD, dir)
  } else {
    const key = { left: 'ArrowLeft', up: 'ArrowUp', down: 'ArrowDown' }[dir]
    await page.keyboard.press(key)
  }
  /* move commits after a 100 ms glide + spawn */
  await page.waitForTimeout(350)
}

test.describe('2048', () => {
  test('moves spawn tiles on touch (mobile profile)', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile')
    const errs = trackErrors(page)
    await seed(page)
    await openGame(page, CARD_ARIA.g2048)

    const board = page.locator(BOARD).first()
    await expect(board).toBeVisible()
    await expect(board.locator('div.absolute.left-0.top-0').first()).toBeVisible()

    const before = await tileCount(page)
    let after = before
    for (const dir of ['left', 'up', 'down', 'left', 'up'] as const) {
      await makeMove(page, true, dir)
      after = await tileCount(page)
      if (after > before) break
    }
    expect(
      after,
      'swiping must spawn at least one tile within 5 gestures'
    ).toBeGreaterThan(before)

    /* UNDO becomes available after a committed move */
    await expect(page.getByRole('button', { name: 'UNDO' })).toBeEnabled()

    expectNoErrors(errs, '2048 touch')
  })

  test('moves spawn tiles on arrow keys (desktop profile)', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop')
    const errs = trackErrors(page)
    await seed(page)
    await openGame(page, CARD_ARIA.g2048)

    const board = page.locator(BOARD).first()
    await expect(board).toBeVisible()

    const before = await tileCount(page)
    let after = before
    for (const dir of ['left', 'up', 'down', 'left', 'up'] as const) {
      await makeMove(page, false, dir)
      after = await tileCount(page)
      if (after > before) break
    }
    expect(after, 'arrow keys must spawn at least one tile').toBeGreaterThan(before)

    await expect(page.getByRole('button', { name: 'UNDO' })).toBeEnabled()

    expectNoErrors(errs, '2048 keyboard')
  })
})
