import { test, expect } from '@playwright/test'
import { seed, trackErrors, expectNoErrors, openGame, CARD_ARIA } from './helpers'

/**
 * Brain Quiz — the robot answers option 1 through a full 10-question round
 * (correct or not) and must see the counter advance and the result screen.
 */

const QUESTIONS = 10

test.describe('quiz', () => {
  test('a full round: answers advance questions, result screen reached', async ({
    page,
  }) => {
    const errs = trackErrors(page)
    await seed(page)
    await openGame(page, CARD_ARIA.quiz)

    await page.getByRole('button', { name: 'Play General quiz' }).click()
    await expect(page.getByText('Question 1/10')).toBeVisible()

    for (let q = 1; q < QUESTIONS; q++) {
      await page.getByRole('button', { name: /^Answer 1:/ }).click()
      await expect(page.getByText(`Question ${q + 1}/10`)).toBeVisible({
        timeout: 10_000,
      })
    }
    /* Final question → result screen */
    await page.getByRole('button', { name: /^Answer 1:/ }).click()
    await expect(page.getByRole('heading', { name: 'Quiz complete!' })).toBeVisible({
      timeout: 15_000,
    })

    /* Round trip back to hub */
    await page.getByRole('button', { name: 'Back to hub' }).last().click()
    await expect(
      page.getByRole('button', { name: CARD_ARIA.quiz }).first()
    ).toBeVisible({ timeout: 10_000 })

    expectNoErrors(errs, 'quiz round')
  })
})
