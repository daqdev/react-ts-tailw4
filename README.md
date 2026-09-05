# React App Template

A single-page application shell to start new apps from: React 19, TypeScript, Tailwind CSS 4,
light/dark theming, and a component kit whose source lives in this repo — no black-box UI dependency.

Built to work on a phone and on a wide desktop monitor from the same code.

## Stack

| Concern        | Choice                                                                 |
|----------------|------------------------------------------------------------------------|
| UI framework   | React 19 + React DOM 19                                                |
| Language       | TypeScript 5.8 (strict, `tsc -b` runs in the build)                    |
| Bundler        | Vite 7                                                                 |
| Styling        | Tailwind CSS 4 via `@tailwindcss/vite`, semantic tokens in `src/index.css` |
| Components     | shadcn/ui style — Radix primitives + CVA, **copied into `src/components/ui`** |
| Icons          | lucide-react                                                           |
| Routing        | React Router 7, routes lazy-loaded                                     |
| Forms          | react-hook-form + zod (one schema drives validation and types)         |
| Unit tests     | Vitest + Testing Library + jsdom                                       |
| E2E tests      | Playwright (desktop 1440×900 and Pixel 5 projects)                     |
| Package mgr    | pnpm                                                                   |

There is no state-management library and no data-fetching layer: add TanStack Query or Zustand
per app when an app actually needs one.

## Commands

```bash
pnpm install
pnpm dev              # dev server
pnpm build            # typecheck + production build
pnpm preview          # serve the build on :4173
pnpm lint             # eslint
pnpm typecheck        # tsc across app, node and e2e configs
pnpm test             # vitest run
pnpm test:watch       # vitest watch
pnpm test:coverage    # vitest + v8 coverage
pnpm test:e2e         # playwright (needs a build; see below)
```

E2E runs against the production build via `pnpm preview`, started automatically by Playwright.
In a sandbox that already ships Chromium, point at it instead of downloading one:

```bash
pnpm build
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e
```

## Theming

Dark mode is a `.dark` class on `<html>`, set by `ThemeProvider` and read by every token.

- Three states: `light`, `dark`, `system`. `system` follows the OS live via `matchMedia`.
- The choice persists in `localStorage` under `app-template-theme`.
- An inline script in `index.html` applies the stored theme **before first paint**, so a dark
  reload never flashes white. If you rename the storage key, rename it there too.
- `color-scheme` is set alongside the class, so scrollbars and native controls follow.

Reading or changing the theme:

```tsx
import { useTheme } from '@/components/theme/use-theme'

const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()
```

Two ready-made controls: `<ThemeToggle />` (light/dark/system menu, in the header) and
`<ThemeSwitch />` (compact switch, used on the settings page).

### Re-skinning an app

Every colour is a CSS variable defined once per theme at the top of `src/index.css`, exposed to
Tailwind through `@theme inline`. Change `--primary` and its `.dark` counterpart and the whole app
follows — buttons, focus rings, links, charts. Components never hard-code a colour; they use the
semantic utilities (`bg-background`, `text-muted-foreground`, `border-border`, …).

## Responsive model

One breakpoint carries the layout: `lg` (1024px).

- **Below `lg`** — single column. Navigation lives in a drawer behind the header's menu button.
- **`lg` and up** — a fixed 16rem sidebar beside a scrolling content column, capped at `max-w-7xl`.

Details that matter on real devices: `min-h-dvh` instead of `100vh`, inputs at 16px so iOS Safari
doesn't zoom on focus, 44px-ish touch targets, `viewport-fit=cover`, dialogs capped at
`100dvh - 2rem`, tab lists that scroll sideways rather than wrap, and a skip-to-content link.
E2E tests assert the page never scrolls horizontally at either size.

## Layout

```
src/
├── components/
│   ├── ui/          The component kit — yours to edit, one file per primitive
│   ├── layout/      AppShell, AppHeader, SidebarNav, PageHeader
│   └── theme/       ThemeProvider, useTheme, ThemeToggle, ThemeSwitch
├── config/nav.ts    Sidebar/drawer/app-name configuration
├── hooks/           useMediaQuery, useIsDesktop
├── lib/utils.ts     cn() — clsx + tailwind-merge
├── pages/           Example pages (dashboard, form, components, settings, 404)
└── test/setup.ts    jsdom shims + matchMedia mock
e2e/                 Playwright specs for theming and responsiveness
```

## Using it for a new app

1. Edit `src/config/nav.ts` — app name, short name, sidebar sections.
2. Change the palette in `src/index.css` (start with `--primary`).
3. Replace the pages under `src/pages/` with your own; keep `<AppShell />` as the layout route.
4. Add primitives as you need them: `pnpm dlx shadcn@latest add <component>` — `components.json`
   is configured, so new files land in `src/components/ui` with the right aliases and paths.

## Component kit

`button`, `input`, `textarea`, `label`, `card`, `badge`, `separator`, `skeleton`, `avatar`,
`checkbox`, `switch`, `tabs`, `select`, `dialog`, `sheet`, `dropdown-menu`, `tooltip`, and `form`
(the react-hook-form field wrappers). `/components` renders all of them on one page, in both
themes, so a regression is visible at a glance.

## The oktools app

This branch is the template. The existing oktools screen is untouched and still reachable at
`/legacy`; its styles are scoped there so `App.css` can't leak into the new layout. Apps move onto
the shell one at a time.
