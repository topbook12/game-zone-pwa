import { test, expect } from '@playwright/test'
import { seed, trackErrors, expectNoErrors } from './helpers'

/**
 * Robots' smoke pass: the hub itself must render, switch language,
 * and open every Phase-2 surface without a single console error.
 */

test.describe('hub', () => {
  test('renders all 5 game cards, header controls and versioned footer', async ({
    page,
  }) => {
    const errs = trackErrors(page)
    await seed(page)
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1, name: 'Game Zone' })).toBeVisible()

    for (const aria of [
      'Play Turbo Rush',
      'Play Brain Quiz',
      'Play 2048 Fusion',
      'Play Snake Neon',
      'Play Car Parking',
    ]) {
      await expect(page.getByRole('button', { name: aria }).first()).toBeVisible()
    }

    await expect(page.getByRole('button', { name: 'Open settings' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Open global leaderboard' })
    ).toBeVisible()

    const footer = page.locator('footer p').first()
    await expect(footer).toBeVisible()
    await expect(footer).toContainText(/Version|ভার্সন/)

    expectNoErrors(errs, 'hub render')
  })

  test('language toggle flips footer copy (EN ⇄ বাংলা)', async ({ page }) => {
    await seed(page)
    await page.goto('/')

    await expect(page.locator('footer p').first()).toContainText('Game Zone © 2025')

    /* The group's aria-label itself switches language, so target buttons directly. */
    await page.getByRole('button', { name: 'বাংলা', exact: true }).click()
    await expect(page.locator('footer p').first()).toContainText('গেম জোন')

    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await expect(page.locator('footer p').first()).toContainText('Game Zone © 2025')
  })

  test('welcome tour greets a fresh visitor and is skippable', async ({ page }) => {
    await seed(page)
    await page.addInitScript(() => localStorage.removeItem('gz-welcome'))
    await page.goto('/')

    const tour = page.getByRole('dialog', { name: 'Welcome to Game Zone!' })
    await expect(tour).toBeVisible({ timeout: 8000 })
    await tour.getByRole('button', { name: 'Skip' }).click()

    await expect(tour).not.toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Game Zone' })).toBeVisible()

    /* The skip is remembered — a reload must not nag again. */
    await page.reload()
    await expect(tour).not.toBeVisible({ timeout: 3000 })
  })

  test('settings center exposes sound / vibration / data-saver', async ({ page }) => {
    await seed(page)
    await page.goto('/')

    await page.getByRole('button', { name: 'Open settings' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/Sound/i)
    await expect(dialog).toContainText(/Vibration|Haptics/i)
    await expect(dialog).toContainText(/Data/i)

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })
})
