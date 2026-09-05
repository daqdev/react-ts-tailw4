import { Component, FormInput, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react'

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
    title: 'Application',
    items: [
      { title: 'Dashboard', to: '/', icon: LayoutDashboard },
      { title: 'Form', to: '/form', icon: FormInput },
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
  name: 'App Template',
  shortName: 'AT',
  description: 'React + TypeScript + Tailwind starter',
}
