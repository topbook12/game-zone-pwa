import { test, expect } from '@playwright/test'
import { seed, openGame, CARD_ARIA } from './helpers'

/**
 * Release-review screenshots: hub + every game at 375 px — uploaded as a CI
 * artifact on every run so a human can eyeball the real UI before a release.
 * Runs on the mobile profile only.
 */

const SHOTS = 'test-results/screenshots'

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '375 px shots run on mobile profile only')
})

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.waitForTimeout(600) // let enter-animations settle
  await page.screenshot({ path: `${SHOTS}/375-${name}.png` })
}

test('capture hub + all games at 375 px', async ({ page }) => {
  await seed(page, { premium: true })

  await page.goto('/')
  await page.getByRole('heading', { level: 1, name: 'Game Zone' }).waitFor()
  await shot(page, 'hub')

  await openGame(page, CARD_ARIA.racing)
  await page.getByRole('button', { name: 'START RACE' }).waitFor()
  await shot(page, 'racing-menu')
  await page.getByRole('button', { name: 'Back to game hub' }).click()

  await openGame(page, CARD_ARIA.quiz)
  await page.getByRole('button', { name: 'Play General quiz' }).waitFor()
  await shot(page, 'quiz-select')
  await page.getByRole('button', { name: 'Back to hub' }).last().click()

  await openGame(page, CARD_ARIA.g2048)
  await page.getByRole('button', { name: 'NEW GAME' }).waitFor()
  await shot(page, '2048-board')
  await page.getByRole('button', { name: 'Back to game hub' }).click()

  await openGame(page, CARD_ARIA.snake)
  await page.getByRole('button', { name: 'START', exact: true }).waitFor()
  await shot(page, 'snake-menu')
  await page.getByRole('button', { name: 'Back to game hub' }).click()

  await openGame(page, CARD_ARIA.parking)
  await page.getByRole('button', { name: 'Level 1', exact: true }).waitFor()
  await shot(page, 'parking-levels')
})
