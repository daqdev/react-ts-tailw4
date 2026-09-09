# Notework

Capture a note under a topic. Reuse topics and the notes wire themselves into a knowledge graph you
can explore, export, and hand to an AI agent to help organise.

Built on the app template in this repo: React 19, TypeScript, Tailwind CSS 4, light/dark theming,
and a component kit whose source lives here — no black-box UI dependency. Works on a phone and on a
wide desktop monitor from the same code.

## What a note is

Three fields, exactly as specified:

| Field | Required | Notes |
|---|---|---|
| **Topic** | yes | Free text. Reusing a topic is what links notes together. |
| **Text** | yes | First line becomes the title; the rest is the body. |
| **Deadline** | no | ISO date. Drives the overdue / due-soon colouring. |

Deadline is optional so the base can hold reference notes as well as things with a due date.

## How the network forms

Notes are never linked to each other directly. They hang off **topic hubs**:

```
        Product                 a parent hub, created automatically
       /       \
Onboarding    Billing           child hubs, from "Product/Onboarding"
   /  \         /  \
note note    note note          every note attaches to its topic
```

- Two notes on the same topic are two hops apart, through their shared hub.
- A topic containing `/` nests: `Product/Onboarding` becomes a child of `Product`. This is what
  joins the whole base into one navigable network rather than a set of separate stars — and it
  costs no extra input, it's a convention in the topic field.
- Topics normalise before matching, so `Design System`, `design system` and `Diseño` vs `Diseno`
  all land on the same hub.

The graph page draws this with a force-directed layout: drag a node, scroll to zoom, click one to
dim everything it isn't connected to. Node colour tracks the deadline (green fine, amber due soon,
red overdue); hub size tracks how many notes it holds.

## Pages

| Route | What it does |
|---|---|
| `/` | Capture form, search, deadline filter, topic filter, note list |
| `/graph` | The knowledge graph, with a detail panel for the selected node |
| `/notes/:id` | One note: read, edit, delete, and its same-topic neighbours |
| `/agent` | Agent digest, JSON/Markdown export, JSON import, schema docs |
| `/components` | The template's component kit, kept as a reference |
| `/settings` | Theme preference |
| `/legacy` | The original oktools screen, untouched |

## Storage

Notes live in **IndexedDB** in your browser — no backend, no account, nothing leaves the machine.
IndexedDB rather than `localStorage` so the base can grow past the ~5MB string cap and hold
structured records. Writes land on disk before the UI updates, so what you see matches what's
stored.

Because it's browser-local, the base is per-device and per-browser. Export is how you move or back
it up.

## Agent-ready output

The `/agent` page is the handoff point. Nothing calls an AI model — this build makes the data
readable, so an agent layer drops on top later without reshaping anything.

- **Digest** — the whole base as plain text, schema explained first, notes grouped by topic with
  overdue counts. Copy it into any agent and ask it to merge duplicates, propose topics, or find
  gaps.
- **JSON** — the full records with a `schemaVersion`, stable ordering, and every field an agent
  needs to write changes back.
- **Markdown vault** — a zip of one `.md` file per note with YAML frontmatter, foldered by topic,
  with a `_index.md` per topic. Unzips straight into Obsidian; equally readable by an agent walking
  a directory. The zip is written by a small store-only writer in `src/lib/zip.ts` — no
  compression library.
- **Import** — merge a JSON export back in, newest edit per id winning. Malformed records are
  skipped and counted rather than failing the whole file.

An agent that reorganises the base only has to return notes with new `topic` values: import
recomputes every key and the graph reshapes itself.

## Stack

| Concern | Choice |
|---|---|
| UI | React 19 + React DOM 19 |
| Language | TypeScript 5.8 (strict, `tsc -b` runs in the build) |
| Bundler | Vite 7 |
| Styling | Tailwind CSS 4, semantic tokens in `src/index.css` |
| Components | shadcn/ui style — Radix primitives + CVA, copied into `src/components/ui` |
| Icons | lucide-react |
| Routing | React Router 7, routes lazy-loaded |
| Forms | react-hook-form + zod |
| Storage | IndexedDB via a small promise wrapper (no dependency) |
| Graph layout | Hand-rolled spring-electrical simulation in SVG (no dependency) |
| Unit tests | Vitest + Testing Library + fake-indexeddb |
| E2E tests | Playwright, desktop 1440×900 and Pixel 5 |
| Package mgr | pnpm |

## Commands

```bash
pnpm install
pnpm dev              # dev server
pnpm build            # typecheck + production build
pnpm preview          # serve the build on :4173
pnpm lint             # eslint
pnpm typecheck        # tsc across app, node and e2e configs
pnpm test             # vitest run
pnpm test:coverage    # vitest + v8 coverage
pnpm test:e2e         # playwright (builds first; see below)
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

```tsx
import { useTheme } from '@/components/theme/use-theme'
const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()
```

Every colour is a CSS variable defined once per theme at the top of `src/index.css`, exposed to
Tailwind through `@theme inline`. Change `--primary` and its `.dark` counterpart and the whole app
follows — including the graph, which paints its nodes with the same tokens.

## Responsive model

One breakpoint carries the layout: `lg` (1024px).

- **Below `lg`** — single column, navigation in a drawer behind the header's menu button.
- **`lg` and up** — a fixed 16rem sidebar beside a scrolling content column, capped at `max-w-7xl`.

`min-h-dvh` instead of `100vh`, inputs at 16px so iOS Safari doesn't zoom on focus, `viewport-fit=cover`,
dialogs capped at `100dvh - 2rem`, tab lists that scroll sideways rather than wrap, and a
skip-to-content link. The graph canvas resizes with its column and is pointer-driven, so drag and
pinch work the same on touch. E2E tests assert the page never scrolls horizontally at either size.

## Layout

```
src/
├── features/notes/         The app
│   ├── types.ts            Note, GraphNode, schema version
│   ├── topic.ts            Topic normalisation and the "/" hierarchy
│   ├── deadline.ts         Overdue / today / soon / later
│   ├── graph.ts            Notes -> nodes and links; topic rollups
│   ├── force-layout.ts     The physics
│   ├── use-force-graph.ts  rAF loop, drag pinning, settle detection
│   ├── graph-canvas.tsx    SVG renderer with pan, zoom and selection
│   ├── storage.ts          IndexedDB wrapper
│   ├── notes-provider.tsx  App state; writes land on disk before the UI moves
│   ├── export.ts           JSON, Markdown vault, agent digest
│   └── import.ts           Parse, repair, merge
├── components/
│   ├── ui/                 The component kit — yours to edit
│   ├── layout/             AppShell, AppHeader, SidebarNav, PageHeader
│   └── theme/              ThemeProvider, useTheme, ThemeToggle, ThemeSwitch
├── config/nav.ts           Sidebar and app name
├── lib/                    cn(), zip writer, download helpers
└── pages/                  One file per route
e2e/                        Playwright specs
```

## Known limits

- The base is per-browser. No sync, no sharing — export/import is the transfer mechanism.
- The graph layout is O(n²) per frame. Comfortable into the hundreds of notes; a few thousand would
  want spatial partitioning.
- Import merges by note id; it does not attempt to reconcile two edits of the same note beyond
  "newest `updatedAt` wins".
