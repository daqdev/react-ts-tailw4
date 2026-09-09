import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(async () => {
  cleanup()
  localStorage.clear()
  document.documentElement.className = ''
  // fake-indexeddb persists across tests in a file; start each one empty.
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('knowledge-notes')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

/**
 * jsdom has no matchMedia. Default to "light"; individual tests override this
 * with `mockMatchMedia(true)` to assert the system-dark path.
 */
export function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches,
    media: '',
    onchange: null,
    addEventListener: (_: string, listener: () => void) => void listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => void listeners.delete(listener),
    addListener: (listener: () => void) => void listeners.add(listener),
    removeListener: (listener: () => void) => void listeners.delete(listener),
    dispatchEvent: () => false,
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  return {
    media,
    /** Simulate the OS switching colour scheme. */
    emit(next: boolean) {
      media.matches = next
      listeners.forEach((listener) => listener())
    },
  }
}

mockMatchMedia(false)

// Radix primitives rely on APIs jsdom does not implement.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
