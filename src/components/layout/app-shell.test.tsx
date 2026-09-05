import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { navSections } from '@/config/nav'
import { AppShell } from './app-shell'

function renderShell(initialPath = '/') {
  return render(
    <ThemeProvider storageKey="shell-test">
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<p>Dashboard content</p>} />
            <Route path="settings" element={<p>Settings content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

const navTitles = navSections.flatMap((section) => section.items.map((item) => item.title))

describe('AppShell', () => {
  it('renders the routed page inside the main landmark', () => {
    renderShell()
    expect(within(screen.getByRole('main')).getByText('Dashboard content')).toBeInTheDocument()
  })

  it('exposes a skip link before the navigation', () => {
    renderShell()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    )
  })

  it('lists every configured destination in the desktop sidebar', () => {
    renderShell()
    const [sidebar] = screen.getAllByRole('navigation', { name: 'Main' })
    navTitles.forEach((title) => {
      expect(within(sidebar).getByRole('link', { name: new RegExp(title) })).toBeInTheDocument()
    })
  })

  it('marks the active route with aria-current', () => {
    renderShell('/settings')
    const [sidebar] = screen.getAllByRole('navigation', { name: 'Main' })
    expect(within(sidebar).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('opens the mobile drawer from the header button and closes it on navigation', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))

    const drawer = await screen.findByRole('dialog')
    await user.click(within(drawer).getByRole('link', { name: 'Settings' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByText('Settings content')).toBeInTheDocument()
  })
})
