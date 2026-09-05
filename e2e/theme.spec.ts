import { expect, test } from '@playwright/test'

const STORAGE_KEY = 'app-template-theme'

test.describe('theme switching', () => {
  test('starts in light when the OS prefers light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('starts in dark when the OS prefers dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('switches to dark from the header menu and repaints the page', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    const lightBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    )

    await page.getByTestId('theme-toggle').click()
    await page.getByRole('menuitem', { name: 'Dark' }).click()

    await expect(page.locator('html')).toHaveClass(/dark/)
    const darkBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    )
    expect(darkBackground).not.toBe(lightBackground)
  })

  test('remembers the choice across a reload, with no light flash', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    await page.getByTestId('theme-toggle').click()
    await page.getByRole('menuitem', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.reload()

    // The inline <head> script applies `.dark` before React ever runs.
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('dark')
  })

  test('the settings page reflects and drives the same state', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/settings')

    await page.getByRole('combobox', { name: 'Theme' }).click()
    await page.getByRole('option', { name: 'Dark' }).click()

    await expect(page.locator('html')).toHaveClass(/dark/)
    // The badge echoes the resolved theme, proving both controls share state.
    await expect(page.getByText('Currently rendering')).toContainText('dark')
  })
})
