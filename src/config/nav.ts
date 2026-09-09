import { Bot, Component, Network, NotebookPen, Settings, type LucideIcon } from 'lucide-react'

export interface NavItem {
  title: string
  to: string
  icon: LucideIcon
  /** Optional short label shown as a badge in the sidebar. */
  badge?: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

/** Single source of truth for the sidebar, the mobile drawer and the page titles. */
export const navSections: NavSection[] = [
  {
    title: 'Knowledge base',
    items: [
      { title: 'Notes', to: '/', icon: NotebookPen },
      { title: 'Graph', to: '/graph', icon: Network },
      { title: 'Agent view', to: '/agent', icon: Bot },
    ],
  },
  {
    title: 'Template',
    items: [
      { title: 'Components', to: '/components', icon: Component, badge: 'Kit' },
      { title: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

export const appConfig = {
  name: 'Notework',
  shortName: 'NW',
  description: 'Notes that build a knowledge graph',
}
