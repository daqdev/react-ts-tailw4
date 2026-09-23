# oktools — Project Specification

> Descriptive specification of the project as it currently exists on the `develop` branch.
> This document describes what is, not what should be. Last reviewed at commit `2c15b55` (Merge pull request #2 from daqdev/jsonvisor).

---

## 1. Purpose

**oktools** is a client-side, single-page web application that provides a small set of developer utilities ("tools") on one screen. A user picks tools from a top-of-page selector; each pick mounts a new, independent tool instance below. Multiple instances of the same tool can run side by side without sharing state.

There is no backend, no persistence, and no authentication. All work happens in the browser tab and is lost on reload.

---

## 2. Tech stack

| Concern        | Choice                                                            |
|----------------|-------------------------------------------------------------------|
| UI framework   | React 19.1 + React DOM 19.1                                       |
| Language       | TypeScript 5.8 (`tsc -b` is part of the build)                    |
| Routing        | React Router DOM 7.7 (one route declared, no real navigation yet) |
| Styling        | Tailwind CSS 4 via `@tailwindcss/vite`; plus some plain CSS classes (`json-tool`, `drop-zone`, …) for the JSON-related tools |
| Bundler        | Vite 7 with `@vitejs/plugin-react`                                |
| Drawing        | rough.js 4.6 (hand-drawn look in the Smart Canvas tool)           |
| Linting        | ESLint 9 + `typescript-eslint`, plus `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` |
| Package mgr    | pnpm (lockfile present)                                           |
| Tests          | None — no test runner, no test files                              |
| CI             | None checked in                                                   |

`package.json` name is `t4il02`, version `0.0.0`, marked `private`. Scripts: `dev`, `build` (`tsc -b && vite build`), `lint`, `preview`.

---

## 3. Directory layout

```
src/
├── main.tsx                       React entry point
├── App.tsx                        BrowserRouter + single route
├── App.css / index.css            Global styles, fonts, Tailwind
├── translations.ts                en / es / pt string tables
├── routes/
│   └── HomePage.tsx               Tool registry + instance manager
├── components/
│   ├── ToolSelector.tsx           Buttons that add tool instances
│   ├── ToolCard.tsx               Container card around each active instance
│   ├── StringTool.tsx             Tool: string splitter / reformatter
│   ├── JsonTool.tsx               Tool: JSON formatter + template validator
│   ├── EpochTool.tsx              Tool: live epoch ticker + converter
│   ├── JsonTemplaterTool.tsx      Tool: JSON → mandatory-field template
│   ├── SmartCanvasTool.tsx        Tool: drawing canvas that tidies shapes
│   ├── JsonTreeNode.tsx           Recursive tree node used by the templater
│   ├── InputPanel.tsx             Shared input UI (used by StringTool)
│   ├── ResultsPanel.tsx           Shared results UI (used by StringTool)
│   ├── ResultsFeed.tsx            Numbered list renderer for parsed items
│   └── SegmentedControl.tsx       Generic two-option toggle
├── interfaces/
│   ├── tool.ts                    ToolConfig, ActiveTool
│   ├── template.ts                Template, TemplateField
│   ├── jsonTemplater.ts           TreeNode
│   └── interfaces.ts              Props for InputPanel / ResultsPanel
├── hooks/
│   └── useTranslation.ts          Tiny i18n hook
└── lib/
    └── sketch/                    Pure shape-recognition + canvas rendering helpers
        ├── geometry.ts            Point math, resampling, RDP simplification
        ├── shapes.ts              recognizeShape, tryAttachArrowHead
        ├── elements.ts            SketchElement type, hit testing
        └── render.ts              rough.js / canvas drawing
```

---

## 4. Application shell

### 4.1 Entry & routing
- `src/main.tsx` mounts `<App />` into `#root`.
- `src/App.tsx` wraps everything in `BrowserRouter` and declares a single route, `/` → `HomePage`. A second route for a `SprintWizardPage` is commented out.

### 4.2 Tool registry and instance model — `src/routes/HomePage.tsx`
- Static array `tools: ToolConfig[]` registers the five available tools by `{ id, name, component }`.
- State: `selectedTools: ActiveTool[]`.
- `addTool(tool)`:
  - generates `instanceId = Date.now()`,
  - picks a random Tailwind background from a 16-color pastel palette (`bg-red-50` … `bg-rose-50`),
  - calls `createElement(tool.component)` and stores the resulting React element on the `ActiveTool`,
  - appends to `selectedTools`.
- `removeTool(instanceId)` filters by `instanceId`.
- Render: page header "oktools" (custom font `Autobusbold`), `<ToolSelector />`, then one `<ToolCard />` per active tool.

### 4.3 Shared types — `src/interfaces/tool.ts`
```ts
interface ToolConfig  { id: number; name: string; component: ComponentType; color?: string }
interface ActiveTool  { id: number; name: string; component: ReactElement;  instanceId: number; color?: string }
```

---

## 5. Tools (main functions)

### 5.1 StringTool — `src/components/StringTool.tsx`
Splits a delimited list and re-emits it with chosen separator / quoting.

- **State:** `inputText`, `parsedData: string[]`, `separator` (`","` or `"\n"`), `quote` (`""`, `'\''`, or `'"'`), `formattedOutput`, `showCopied`.
- **Parse (`analyzeData`):** splits by `\n`, then each line by `,`, trims each item, strips a single surrounding pair of `"` or `'` quotes, drops empties.
- **Render (`updateFormattedOutput`):** if a quote is selected, wraps each item with it (escaping existing instances), joins with `, ` or `\n` depending on `separator`.
- **Effects:** `useEffect` re-runs parse whenever `inputText` changes, and re-runs render whenever `parsedData / separator / quote` change.
- **UI:** two-column layout. Left = `InputPanel` (textarea + `SegmentedControl`s for separator and quote + Analyze / Clear buttons). Right = `ResultsPanel` (numbered list of parsed items via `ResultsFeed` + read-only formatted output + Copy button with "Copied!" toast).
- **Clipboard:** `navigator.clipboard.writeText`.

### 5.2 JsonTool — `src/components/JsonTool.tsx`
Formats JSON and optionally validates it against a *template* describing mandatory fields.

- **State:** `inputJson`, `formattedJson`, `error`, `isDragging`, `isTemplateDragging`, `validationStatus` (`'valid' | 'invalid' | 'none'`), `template: Template | null`, `missingFields: Set<string>`.
- **Input sources:** typed/pasted into the main textarea, or a file dropped onto the main drop zone (`text/plain` or `application/json`, read with `FileReader.readAsText`).
- **Template input:** a separate drop zone accepts a template file. `validateTemplate(text)` requires the parsed JSON to be an object containing `mandatoryFields: TemplateField[]`, with each field having string `key`, `type`, and `path`. An empty `mandatoryFields` array is considered valid.
- **Format pipeline (debounced 500 ms via `useEffect` + `setTimeout`):**
  1. If input is empty → clear output, errors, missing fields.
  2. `JSON.parse(inputJson)` → `JSON.stringify(parsed, null, 2)`; if a template is loaded, run `validateJsonAgainstTemplate`.
  3. On parse failure → set an error message and emit a best-effort partially-formatted string (a sequence of `String.replace` calls that pass through escape sequences).
- **Mandatory-field check (`validateJsonAgainstTemplate`):** for each `field.path` (e.g. `root.user.email[]`), walks the parsed JSON dot-by-dot. The literal segment `root` is skipped. A segment ending in `[]` requires the named key to be a non-empty array; further descent uses the first element. Missing paths are collected into the returned `Set<string>`.
- **Output UI:** read-only textarea with formatted JSON (red-tinted via `validation-error` class if any mandatory fields are missing), a "Copy Formatted JSON" button, and an inline message listing missing field paths.
- **Styling:** mostly plain CSS classes (`json-tool`, `drop-zone`, `template-drop-zone`, `validation-error`) rather than Tailwind. The template drop zone changes color based on `validationStatus`.

### 5.3 EpochTool — `src/components/EpochTool.tsx`
Live epoch display + epoch ↔ human-readable date converter.

- **Live ticker:** `setInterval` updates `currentTimestamp` to `Date.now()` every 250 ms (cleared on unmount). `displayedEpoch` is either ms or floor-divided seconds based on `useMilliseconds`.
- **Conversion:** on change of `epochInput`, `useUtc`, or `useMilliseconds`, parses input as a number; treats it as seconds or milliseconds; formats with `Date#toLocaleString` and `Intl.DateTimeFormatOptions` (month/day/year + 2-digit time + short time-zone name). When `useUtc` is true, `timeZone: 'UTC'` is set in the options. Non-numeric or invalid dates produce `"Invalid epoch value"`.
- **Controls:**
  - **Copy** — copies `displayedEpoch` (label flips to `Copied!` / `Failed` for 1.5 s).
  - **Use current** — populates the input with `displayedEpoch`.
  - **Show seconds / Show milliseconds** — toggles `useMilliseconds`. The pending input value is also converted in place via `Math.floor(value * 1000)` or `/ 1000` so the visible date is stable across the toggle.
  - **Show local time / Show UTC** — toggles `useUtc`.
- **UI:** Tailwind only. Large mono code block for the live epoch, then a labelled input, the two toggle buttons, and the converted-date display.

### 5.4 JsonTemplaterTool — `src/components/JsonTemplaterTool.tsx`
Authors a template that JsonTool can later consume.

- **State:** `inputJson`, `templateJson`, `treeData: TreeNode | null`, `mandatoryFields: Set<string>` (set of paths).
- **Tree build (`useEffect` on `inputJson`):** `buildTree(data, path)` recurses; objects expand each key under `path.key`; non-empty arrays-of-objects descend into the first element under `path[]`. Primitives become leaves with `type = typeof data`. Parse failures clear the tree.
- **Template emission (`useEffect` on `mandatoryFields` / `treeData`):** traverses the tree and collects every node whose `path` is in `mandatoryFields` as `{ key, type, path }`, wraps them in `{ mandatoryFields: [...] }`, and writes the pretty-printed JSON to `templateJson`. The output schema therefore matches what JsonTool's `validateTemplate` expects.
- **UI:** three stacked regions — input textarea, interactive tree (`JsonTreeNode` renders each node with a checkbox bound to `handleMandatoryChange`), and read-only template textarea.

### 5.5 SmartCanvasTool — `src/components/SmartCanvasTool.tsx`
Drawing canvas that tidies hand-drawn diagram shapes (BACKLOG §0, phase A). Everything runs locally; no ML model, no network.

- **Modes:** *Smart* (recognize and snap), *Freehand* (keep strokes as drawn), *Eraser* (drag over elements to delete them; one undo step per drag).
- **Recognition (`src/lib/sketch/shapes.ts`, pure):** `recognizeShape(stroke)` resamples the stroke to 64 points, then:
  - open strokes → line (straightness ≥ 0.9) or single-stroke arrow (straight shaft + short head whose barbs point back); both snap to multiples of 45° when within 8°;
  - closed strokes → compares an ellipse fit against a polygon fit (Ramer–Douglas–Peucker + removal of flat/crowded vertices): ellipse/circle, triangle, rectangle/square (made axis-aligned) or diamond.
  - Returns `{ shape, name, score }` or `null` (stroke is then kept as freehand). Scores go from 0.5 (at threshold) to 1.
  - `tryAttachArrowHead(line, stroke)` turns a line into an arrow when the next stroke (within 4 s) is a small head at one of its ends.
- **Elements (`src/lib/sketch/elements.ts`):** flat `SketchElement[]` (`line`, `arrow`, `rectangle`, `ellipse`, `diamond`, `triangle`, `freehand`), each with a style that includes a fixed rough.js `seed` so redraws don't wobble, and the original `raw` strokes so "Keep as drawn" can revert a snap. `hitTest` is used by the eraser.
- **Rendering (`src/lib/sketch/render.ts`):** rough.js (`roughjs` npm package) for shapes, smoothed quadratic path for freehand. Two stacked canvases: base (all elements, redrawn on change) and overlay (live stroke, drawn incrementally).
- **State:** `history = { past, present, future }` for undo/redo (buttons, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z while the tool has focus), plus tool, color, stroke width, roughness and the last recognition status. Export to PNG on a white background.
- **Canvas size:** the canvas fills the visible area (480 px tall in the card, the whole window in full screen) but never shrinks below its content (`contentExtent` + margin); when the content is larger than the view, the drawing area scrolls. There is no infinite canvas / pan / zoom yet.
- **Full screen:** uses the Fullscreen API on the tool's container, with a fixed-overlay fallback when the API is refused (e.g. in an iframe). Esc (or the button) returns to the card view.
- **Chalkboard theme (`src/lib/sketch/palette.ts`):** only the drawing area switches to a black background. Elements store a palette key (`ink`, `indigo`, …) rather than a hex color, and each key has a light and a chalkboard value, so toggling the theme recolors existing drawings. PNG export uses the current theme's background.
- **UI strings** go through `useTranslation` (`canvas*` and `shape_*` keys).

---

## 6. Shared infrastructure

### 6.1 Reusable UI
- **`InputPanel`** (`src/components/InputPanel.tsx`) — textarea + two `SegmentedControl`s + Analyze / Clear buttons. Used by `StringTool`. Texts go through `useTranslation`.
- **`ResultsPanel`** (`src/components/ResultsPanel.tsx`) — wraps `ResultsFeed` + copyable formatted output. Used by `StringTool`.
- **`ResultsFeed`** (`src/components/ResultsFeed.tsx`) — numbered list of parsed items.
- **`SegmentedControl`** (`src/components/SegmentedControl.tsx`) — generic two-option button toggle.
- **`ToolSelector`** (`src/components/ToolSelector.tsx`) — one button per registered tool, calls `onSelect`.
- **`ToolCard`** (`src/components/ToolCard.tsx`) — colored card container with a remove control.
- **`JsonTreeNode`** (`src/components/JsonTreeNode.tsx`) — recursive node for the templater, with a mandatory-field checkbox.

### 6.2 Types — `src/interfaces/`
- `tool.ts`: `ToolConfig`, `ActiveTool`.
- `template.ts`: `Template = { mandatoryFields: TemplateField[] }`, `TemplateField = { key, type, path }`.
- `jsonTemplater.ts`: `TreeNode = { key, type, path, children? }`.
- `interfaces.ts`: prop types for `InputPanel` and `ResultsPanel`.

### 6.3 Internationalisation — `src/hooks/useTranslation.ts` + `src/translations.ts`
- Three locales in order: `en`, `es`, `pt`.
- `useTranslation()` returns `{ t, toggleLanguage, currentLang }`.
- `t(key, params)` looks up `translations[currentLang][key]`, falls back to the key itself, and substitutes `{param}` placeholders.
- `toggleLanguage()` cycles through `langOrder`.
- Currently consumed only by the String Tool input panel (the hook is imported but the import in `StringTool.tsx` is commented out — translation is wired in via `InputPanel.tsx`).

---

## 7. Build & run

- `pnpm install`
- `pnpm dev` — Vite dev server with HMR.
- `pnpm build` — `tsc -b && vite build`.
- `pnpm lint` — ESLint over the repo.
- `pnpm preview` — preview the production build.

No environment variables. No external API calls. No service workers.

---

## 8. Known limitations / things to be aware of

These are characteristics of the current code, not requirements:

- **Instance ID collisions:** `HomePage.tsx` uses `Date.now()` for `instanceId`. Two rapid clicks within the same millisecond produce duplicate keys and break `removeTool` for those instances.
- **Element-in-state:** `addTool` stores a pre-built `ReactElement` on `ActiveTool` via `createElement(tool.component)`. It works but it's unusual; storing the component type would be more idiomatic.
- **Router stub:** only one route exists; `react-router-dom` is essentially unused.
- **No persistence:** tool inputs, the loaded template, and the language selection are all lost on reload.
- **Mixed styling:** Tailwind classes for most of the UI, but `JsonTool` and `JsonTemplaterTool` use plain CSS class names (`drop-zone`, `json-tool`, `json-input`, …) whose definitions live in the global CSS rather than alongside the components.
- **Template path matcher:** `validateJsonAgainstTemplate` only inspects the first element of any `[]` array — it does not check every element.
- **Partial-format fallback:** when JSON parsing fails, `JsonTool` runs a chain of `String#replace` calls that pass escape sequences through unchanged, then displays the result. This is best-effort cosmetic behaviour, not a fix-up of malformed JSON.
- **No tests, no CI.** The only correctness gates are `tsc -b` and ESLint.
- **Dead code:** `HomePage.tsx:14-15` (commented-out tool slots) and `App.tsx:4,12` (commented-out `SprintWizardPage` route).
