# Multi Tool Workbench

A small productivity playground that lets you spin up multiple utilities side by side. The current line-up includes helpers for string manipulation, JSON inspection, and epoch timestamp conversions.

## Tech Stack at a Glance
- React 18 + TypeScript (TSX components throughout)
- Vite for bundling and dev server
- Tailwind CSS utility classes for styling
- pnpm for dependency management

## Available Tools
| Tool | What it does |
| --- | --- |
| String Tool | Quickly split, trim, quote, and reformat delimited strings. |
| JSON Tool | View and validate JSON snippets. |
| Epoch Tool | Live epoch ticker with conversion to human-readable timestamps. |

Each tool is defined through a small `ToolConfig` (see `src/interfaces/tool.ts`) so adding a new utility is as simple as registering a component.

## Development
```bash
pnpm install        # install dependencies
pnpm run dev        # start Vite dev server
pnpm run build      # type-check and build for production
```

## Project Notes
- Tool selection happens in `src/routes/HomePage.tsx`; each selection instantiates a fresh component instance, so tools keep their own state.
- Shared type definitions live under `src/interfaces` to avoid duplicated shapes and keep the tool registry consistent.
- Tailwind classes are defined inline; adjust `src/index.css` or `tailwind.config` (if added later) for global tweaks.

Feel free to extend the toolbox with more utilities—drop a component in `src/components`, register it in the `tools` array, and you’re ready to go.
