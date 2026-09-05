import { useEffect, useState } from 'react'

/** Subscribe to a CSS media query from JS (e.g. `useMediaQuery('(min-width: 1024px)')`). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const listener = () => setMatches(media.matches)
    listener()
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

/** Tailwind's `lg` breakpoint: true on tablets in landscape and desktops. */
export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)')
}
