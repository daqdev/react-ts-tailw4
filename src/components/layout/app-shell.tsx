import { Link, Outlet } from 'react-router-dom'
import { appConfig } from '@/config/nav'
import { AppHeader } from './app-header'
import { SidebarNav } from './sidebar-nav'

/**
 * The responsive frame every page renders inside.
 *
 * < lg : single column, navigation lives in a drawer behind the header button.
 * >= lg: fixed 16rem sidebar beside a scrolling content column.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">
              {appConfig.shortName}
            </span>
            <span className="truncate">{appConfig.name}</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <p className="border-t p-4 text-xs text-muted-foreground">v0.1.0 · template</p>
      </aside>

      <div className="lg:pl-64">
        <AppHeader />
        <main id="main-content" className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
