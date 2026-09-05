import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { appConfig } from '@/config/nav'
import { SidebarNav } from './sidebar-nav'

/**
 * Sticky top bar. Below `lg` it owns the navigation drawer trigger;
 * from `lg` up the persistent sidebar takes over and the trigger is hidden.
 */
export function AppHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{appConfig.name}</SheetTitle>
            <SheetDescription>{appConfig.description}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto">
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Link to="/" className="flex items-center gap-2 font-semibold lg:hidden">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">
          {appConfig.shortName}
        </span>
        <span className="truncate">{appConfig.name}</span>
      </Link>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Avatar>
          <AvatarFallback>DQ</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
