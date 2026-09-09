import { expect, test, type Page } from '@playwright/test'

async function addNote(
  page: Page,
  { topic, text, deadline }: { topic: string; text: string; deadline?: string },
) {
  await page.getByLabel('Topic', { exact: true }).fill(topic)
  await page.getByLabel('Note', { exact: true }).fill(text)
  if (deadline) await page.getByLabel('Deadline', { exact: true }).fill(deadline)
  await page.getByRole('button', { name: 'Add note' }).click()
}

test.describe('notes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Each test starts from an empty base, whatever ran before it.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase('knowledge-notes')
          request.onsuccess = () => resolve()
          request.onerror = () => resolve()
          request.onblocked = () => resolve()
        }),
    )
    await page.reload()
  })

  test('captures a note and lists it', async ({ page }) => {
    await expect(page.getByText(/No notes yet/)).toBeVisible()

    await addNote(page, { topic: 'Product/Onboarding', text: 'Welcome email\nNeeds a rewrite.' })

    const card = page.getByTestId('note-card')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('Welcome email')
    await expect(card).toContainText('Product/Onboarding')
  })

  test('survives a reload', async ({ page }) => {
    await addNote(page, { topic: 'Ops', text: 'Rotate keys' })
    await expect(page.getByTestId('note-card')).toHaveCount(1)

    await page.reload()

    await expect(page.getByTestId('note-card')).toHaveCount(1)
    await expect(page.getByTestId('note-card')).toContainText('Rotate keys')
  })

  test('flags an overdue deadline', async ({ page }) => {
    await addNote(page, { topic: 'Ops', text: 'Renew certificate', deadline: '2020-01-01' })

    await expect(page.getByTestId('note-card')).toContainText('overdue')
  })

  test('builds a graph from the topic hubs', async ({ page }) => {
    await addNote(page, { topic: 'Product/Onboarding', text: 'Welcome email' })
    await expect(page.getByTestId('note-card')).toHaveCount(1)
    await addNote(page, { topic: 'Product/Billing', text: 'Invoice copy' })
    await expect(page.getByTestId('note-card')).toHaveCount(2)

    await page.goto('/graph')

    const svg = page.getByRole('img', { name: /Knowledge graph/ })
    await expect(svg).toBeVisible()
    // 2 notes + Product + Onboarding + Billing hubs.
    await expect(svg).toHaveAttribute('aria-label', /5 nodes/)
    await expect(svg.locator('line')).toHaveCount(4)
  })

  test('opens a note from its card and shows same-topic neighbours', async ({ page }) => {
    await addNote(page, { topic: 'Ops', text: 'Rotate keys' })
    await expect(page.getByTestId('note-card')).toHaveCount(1)
    await addNote(page, { topic: 'Ops', text: 'Audit access' })
    await expect(page.getByTestId('note-card')).toHaveCount(2)

    await page.getByRole('link', { name: 'Audit access' }).click()

    await expect(page).toHaveURL(/\/notes\//)
    await expect(page.getByRole('heading', { name: 'Ops', level: 1 })).toBeVisible()
    await expect(page.getByText('1 connected note.')).toBeVisible()
  })

  test('edits a note and the change sticks', async ({ page }) => {
    await addNote(page, { topic: 'Ops', text: 'Rotate keys' })
    await page.getByRole('link', { name: 'Rotate keys' }).click()

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Note', { exact: true }).fill('Rotate keys quarterly')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Rotate keys quarterly')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Rotate keys quarterly')).toBeVisible()
  })

  test('deletes a note after confirming', async ({ page }) => {
    await addNote(page, { topic: 'Ops', text: 'Temporary note' })
    await page.getByRole('link', { name: 'Temporary note' }).click()

    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Delete note' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText(/No notes yet/)).toBeVisible()
  })

  test('exposes the base as an agent-readable digest', async ({ page }) => {
    await addNote(page, { topic: 'Product/Onboarding', text: 'Welcome email', deadline: '2020-01-01' })
    await expect(page.getByTestId('note-card')).toHaveCount(1)

    await page.goto('/agent')

    const digest = page.getByTestId('agent-digest')
    await expect(digest).toContainText('# Knowledge base')
    await expect(digest).toContainText('Schema version 1')
    await expect(digest).toContainText('## Product/Onboarding  (1 notes, 1 overdue)')
    await expect(digest).toContainText('deadline: 2020-01-01')
    await expect(digest).toContainText('Welcome email')
  })
})
