import '@/App.css'
import HomePage from './HomePage'

/**
 * The pre-template oktools screen, kept reachable at /legacy while the apps
 * are migrated onto the new shell. It carries its own legacy stylesheet so
 * `App.css` never leaks into the template layout.
 */
export default function LegacyToolsPage() {
  return <HomePage />
}
