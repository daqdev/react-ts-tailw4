import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { mockMatchMedia } from '@/test/setup'
import { ThemeProvider } from './theme-provider'
import { useTheme } from './use-theme'

function Probe() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('dark')}>set dark</button>
      <button onClick={() => setTheme('system')}>set system</button>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  )
}

function renderProbe(storageKey = 'test-theme') {
  return render(
    <ThemeProvider storageKey={storageKey}>
      <Probe />
    </ThemeProvider>,
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  it('defaults to the system theme and resolves it', () => {
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('resolves system to dark when the OS prefers dark', () => {
    mockMatchMedia(true)
    renderProbe()
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('applies the .dark class and persists the choice', async () => {
    const user = userEvent.setup()
    renderProbe('persist-key')

    await user.click(screen.getByRole('button', { name: 'set dark' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('persist-key')).toBe('dark')
  })

  it('restores the stored theme on the next mount', () => {
    localStorage.setItem('restore-key', 'dark')
    renderProbe('restore-key')
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('ignores an unrecognised stored value', () => {
    localStorage.setItem('bad-key', 'chartreuse')
    renderProbe('bad-key')
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
  })

  it('toggles between light and dark', async () => {
    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'toggle' }))
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')

    await user.click(screen.getByRole('button', { name: 'toggle' }))
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })

  it('follows live OS changes while set to system', async () => {
    const media = mockMatchMedia(false)
    renderProbe()

    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
    act(() => media.emit(true))
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })

  it('stops following the OS once an explicit theme is picked', async () => {
    const user = userEvent.setup()
    const media = mockMatchMedia(false)
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'set dark' }))
    act(() => media.emit(false))

    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })
})

describe('useTheme', () => {
  it('throws outside a provider', () => {
    expect(() => render(<Probe />)).toThrow(/within a ThemeProvider/)
  })
})
