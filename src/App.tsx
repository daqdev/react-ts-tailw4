import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NotesProvider } from '@/features/notes/notes-provider'
import NotesPage from '@/pages/NotesPage'

// Everything past the capture page is code-split, so the initial bundle stays small.
const GraphPage = lazy(() => import('@/pages/GraphPage'))
const NoteDetailPage = lazy(() => import('@/pages/NoteDetailPage'))
const AgentPage = lazy(() => import('@/pages/AgentPage'))
const ComponentsPage = lazy(() => import('@/pages/ComponentsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const LegacyToolsPage = lazy(() => import('@/routes/LegacyToolsPage'))

function RouteFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="app-template-theme">
      <NotesProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<NotesPage />} />
                  <Route path="graph" element={<GraphPage />} />
                  <Route path="notes/:id" element={<NoteDetailPage />} />
                  <Route path="agent" element={<AgentPage />} />
                  <Route path="components" element={<ComponentsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
                {/* Existing oktools screen, untouched, until the apps move over. */}
                <Route path="/legacy" element={<LegacyToolsPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </NotesProvider>
    </ThemeProvider>
  )
}
