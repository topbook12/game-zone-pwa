import { test, expect } from '@playwright/test'
import { seed, trackErrors, expectNoErrors, openGame, CARD_ARIA } from './helpers'

/**
 * Car Parking — VIP-seeded robot SOLVES level 1 (par 2):
 * 1. Slide car G (vertical, blocking the exit at (4,2)) up with ArrowUp.
 * 2. Slide the VIP car X right with ArrowRight → reaches the edge → PARKED!
 * Verifies undo enabling, the win dialog, and the next-level round trip.
 */

test.describe('parking', () => {
  test('solves level 1 at par (both profiles)', async ({ page }) => {
    const errs = trackErrors(page)
    await seed(page, { premium: true })
    await openGame(page, CARD_ARIA.parking)

    /* Level select */
    await expect(page.getByText('Solved: 0/40')).toBeVisible()
    await page.getByRole('button', { name: 'Level 1', exact: true }).click()

    await expect(page.getByText(/0 moves/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo move' })).toBeDisabled()

    /* Move the blocker up, then drive the VIP car out */
    await page.getByRole('button', { name: 'Car G' }).click()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByText(/1 moves/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo move' })).toBeEnabled()

    await page.getByRole('button', { name: 'VIP car X' }).click()
    await page.keyboard.press('ArrowRight')

    /* Solved! */
    const win = page.getByRole('dialog', { name: 'PARKED! 🏆' })
    await expect(win).toBeVisible({ timeout: 10_000 })
    await expect(win.getByText(/2 moves/)).toBeVisible()
    await expect(win.getByRole('button', { name: 'Next level' })).toBeVisible()

    /* Next level resets the board */
    await win.getByRole('button', { name: 'Next level' }).click()
    await expect(page.getByText(/0 moves/)).toBeVisible({ timeout: 10_000 })

    expectNoErrors(errs, 'parking solve')
  })
})
