import { expect, test } from '@playwright/test'

test.describe('responsive layout', () => {
  test('desktop shows the persistent sidebar and hides the drawer trigger', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop-only expectation')
    await page.goto('/')

    await expect(page.getByRole('complementary')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden()
  })

  test('mobile hides the sidebar and navigates through the drawer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile-only expectation')
    await page.goto('/')

    await expect(page.getByRole('complementary')).toBeHidden()

    await page.getByRole('button', { name: 'Open navigation' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    await drawer.getByRole('link', { name: 'Components' }).click()
    await expect(page).toHaveURL(/\/components$/)
    await expect(drawer).toBeHidden()
  })

  test('content never scrolls sideways', async ({ page }) => {
    await page.goto('/components')
    await expect(page.getByRole('heading', { name: 'Components', level: 1 })).toBeVisible()

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflows).toBe(false)
  })

  test('the dialog stays inside the viewport', async ({ page }) => {
    await page.goto('/components')
    await page.getByRole('tab', { name: 'Overlays' }).click()
    await page.getByRole('button', { name: 'Open dialog' }).click()

    const box = await page.getByRole('dialog').boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.width).toBeLessThanOrEqual(viewport!.width)
    expect(box!.height).toBeLessThanOrEqual(viewport!.height)
  })
})
