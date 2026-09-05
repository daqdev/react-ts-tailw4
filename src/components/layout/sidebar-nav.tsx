import { NavLink } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { navSections } from '@/config/nav'
import { cn } from '@/lib/utils'

export interface SidebarNavProps {
  /** Called after a link is activated — used to close the mobile drawer. */
  onNavigate?: () => void
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  return (
    <nav className="flex flex-col gap-6 p-3" aria-label="Main">
      {navSections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </p>
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors sm:py-2',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground',
                )
              }
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{item.title}</span>
              {item.badge && (
                <Badge variant="secondary" className="ml-auto">
                  {item.badge}
                </Badge>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}
