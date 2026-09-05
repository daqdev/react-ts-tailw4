import { createContext } from 'react'

/** What the user picked. `system` follows the OS setting live. */
export type Theme = 'light' | 'dark' | 'system'
/** What is actually on screen once `system` is resolved. */
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  /** Flips between light and dark, resolving `system` first. */
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const THEME_STORAGE_KEY = 'ui-theme'
