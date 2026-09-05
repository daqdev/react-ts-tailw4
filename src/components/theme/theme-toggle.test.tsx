import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from './theme-provider'
import { ThemeToggle } from './theme-toggle'

describe('ThemeToggle', () => {
  it('switches the document to dark via the menu', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider storageKey="toggle-test">
        <ThemeToggle />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Change theme' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Dark' }))

    expect(document.documentElement).toHaveClass('dark')
  })

  it('offers light, dark and system', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider storageKey="toggle-options">
        <ThemeToggle />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Change theme' }))

    expect(await screen.findByRole('menuitem', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'System' })).toBeInTheDocument()
  })
})
