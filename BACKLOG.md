# Backlog

Ordered list of upcoming work. Pick tasks top-down; later tasks assume earlier ones are done.

---

## 0. Smart Canvas tool — "Paint" that cleans up diagrams — ⚠️ PRIORITY: HIGHEST

**Goal:** add a new tool to the tool registry (`src/routes/HomePage.tsx`) where the user draws with mouse / pen / touch and the app "tidies up" the strokes: rough boxes become clean rectangles, wobbly lines become straight lines or arrows, and handwritten letters/digits become text. Target use case: quickly sketching diagrams (boxes, circles, diamonds, lines, arrows, labels).

**Hard constraints:**
- **100 % local.** No remote services, no cloud OCR, no runtime CDN scripts. Everything bundled by Vite.
- **Fast.** Recognition must run synchronously on pointer-up in a few ms (budget: < 5 ms per stroke group on a mid-range laptop). No heavy ML models in the first phases.
- Order of work is **easiest + most performant first**; each phase ships something usable on its own.

**Also not in scope for now:** tasks 1–4 below don't block this task. Still, put all recognition logic in pure modules under `src/lib/sketch/` (no React, no DOM) so it's easy to unit-test once task 2 lands — this matches the direction set in task 1.

### 0.1 Reference prototype: `interactive_canvas_app.html` (repo root, untracked)

A standalone HTML/JS prototype ("AI Smart Canvas"). Useful as a **UX reference**, not as code to port as-is.

What's worth keeping:
- UI concept: toolbar with *Smart / Raw / Select / Eraser*, color palette, stroke-width and roughness sliders, undo/redo, zoom/pan, PNG/SVG export, toast showing what was recognized + confidence.
- Hand-drawn look for clean shapes using **rough.js** (MIT, ~9 KB gz). Add it as an npm dependency (`roughjs`) instead of the CDN.
- Element model: a flat `elements[]` list of typed objects (`rectangle`, `circle`, `line`, `arrow`, `text`, `freehand`, …) redrawn from scratch on each change. Simple and good enough.
- Two outputs for recognized text: re-draw as vector strokes vs. convert to an editable text element. We only need the **editable text** output — drop the vector-glyph path table.

Problems found in the prototype (do **not** carry these over):
- **Character recognition is effectively fake.** `recognizeCharacter` is a handful of if-rules: any closed round-ish stroke is `0`, any tall thin stroke is `1`, any open stroke with ≥ 2 corners is `Z`/`L`/`3`, and the fallback returns `A` with 75 % "confidence". The comment says "$1 Unistroke" but no $1 algorithm is implemented.
- **Single-stroke only.** Each stroke is recognized in isolation, so multi-stroke characters (`E`, `T`, `A`, `4`, `X`, `+`…) and multi-stroke arrows (line + separate head) can never work.
- Shape detection is fragile: corners are computed on raw (un-resampled) points with a fixed step of 4, so results depend on drawing speed; circle vs. polygon is decided only by corner count; arrowhead detection only looks at the last 12 raw points.
- Confidence numbers are hard-coded constants, not scores.
- Shapes are always resolved before characters, so small letters like `O`/`0`, `D`, `L` get turned into shapes.
- `id: Date.now()` for elements (same collision issue as `instanceId`, see SPEC §8); undo stores a full `JSON.stringify` snapshot per action; `e.spaceKey` doesn't exist, so space-to-pan never works; mixes Tailwind CDN + global DOM state.

### 0.2 Recommended approach (phased)

**Phase A — Shapes mode (easiest, highest value).** ✅ Done — see SPEC §5.5. Corners are found with Ramer–Douglas–Peucker simplification plus cleanup instead of ShortStraw (simpler, same result on the test strokes); recognition takes ≤ 1 ms per stroke.
- React component `src/components/SmartCanvasTool.tsx` with a `<canvas>`, Pointer Events (`pointerdown/move/up` covers mouse, pen and touch in one API; use `setPointerCapture`), toolbar, undo/redo, clear, PNG export. Register it in the `tools` array and add en/es/pt strings to `src/translations.ts`.
- `src/lib/sketch/geometry.ts`: resample stroke to N equidistant points (as in $1), bounding box, path length, closedness.
- `src/lib/sketch/shapes.ts`: heuristic shape classifier on the **resampled** stroke:
  - line: straightness (chord / path length) > ~0.9;
  - arrow: line + head detected either in the same stroke (tail hook) or as a **second stroke** drawn near the line end within a short time window;
  - circle/ellipse: closed stroke with low variance of distance to centroid;
  - rectangle / square / diamond / triangle: closed stroke, corners via **ShortStraw** (simple, fast, well-known corner finder) — 3 corners → triangle, 4 → rectangle or diamond depending on whether corners sit on bbox edges or bbox mid-points;
  - otherwise keep as smoothed freehand.
- Return a real score (e.g. fit error normalized to size) and only snap when above a threshold; otherwise keep the freehand stroke. Offer a one-click "undo snap" (keep the raw stroke in the element so it can be reverted).

**Phase B — Text mode with a mode selector (letters & digits).** ✅ Done — see SPEC §5.5. Differences from the plan below: instead of closing a character on each pause, everything written before a pause is split into characters by trying the possible splits (so words can be written fluently); built-in templates are generated from stroke descriptions (one or two per character) rather than recorded samples.
- Add a **mode selector**: `Shapes | Text`. Explicit mode is the most accurate and cheapest option, so it comes first.
- Recognizer: **$Q (or $P) point-cloud recognizer** — multistroke, stroke-order and direction invariant, ~200 lines of TS, no model, sub-millisecond per match with a few hundred templates. Put it in `src/lib/sketch/pointCloud.ts`.
- **Stroke grouping:** strokes belong to the same character while the pen goes down again within ~400–600 ms *and* near the current group's bbox; a pause or a far-away stroke closes the group and triggers recognition. Consecutive characters on the same baseline merge into one text element (word).
- **Templates:** ship a default set for `0–9` and `A–Z` (a few samples each, stored as JSON in `src/lib/sketch/templates/`). Add a small "teach" UI: when the result is wrong, the user picks the right character and the stroke group is saved as a new template in `localStorage` — accuracy improves per user at zero cost.
- Output: an editable text element positioned at the group's bbox, font size derived from bbox height.
- Lowercase letters are **out of scope** for this phase (much more ambiguous with this technique); revisit after Phase D.

**Phase C — Auto mode (detect everything together).**
- Third option in the selector: `Auto`. Run both classifiers on each closed stroke group and pick by score + simple priors: small groups (height below ~2× current stroke-size-based threshold, or several strokes in quick succession) favour Text; large single strokes favour Shapes. Ambiguous → keep freehand rather than guess.
- Shape-inside-shape context helps: strokes drawn inside a recognized box are very likely a label → favour Text.

**Phase D — Transparent text field ("ink-to-text zone").**
- The user drags out a text box (or double-clicks inside a shape) and gets a transparent overlay; everything written inside it is always treated as Text, grouped left-to-right into one string, and committed to that box's text on blur/Enter. The result stays editable with the keyboard.
- This removes most Auto-mode ambiguity and is the natural way to label boxes and arrows.

**Phase E (optional, only if $Q accuracy isn't enough).**
- Local CNN character classifier trained on EMNIST, exported to ONNX and run with `onnxruntime-web` (WASM) or a hand-written tiny MLP. Still offline, but adds ~0.5–5 MB to the bundle and a lazy-loaded chunk — only consider after measuring Phase B/C accuracy with real users.

### 0.3 Out of scope (for now)
- Connectors that stay attached to shapes when moving them, snapping/alignment guides, multi-select, persistence to backend, collaboration.
- Cursive / full-sentence handwriting recognition.

**Done when (per phase):**
- A: the Smart Canvas tool can be added from the tool selector; rectangle, square, circle, ellipse, diamond, triangle, line and arrow (single or two strokes) are snapped reliably; undo/redo and PNG export work; recognition runs locally in < 5 ms per stroke.
- B: in Text mode, digits `0–9` and uppercase `A–Z` (single and multistroke) become editable text; the user can correct a result and the correction is learned.
- C: Auto mode handles a simple diagram (boxes + arrows + short labels) without switching modes, falling back to freehand when unsure.
- D: writing inside a transparent text field produces one editable string.
- All phases: logic lives in `src/lib/sketch/*`, `pnpm build` and `pnpm lint` are green, `SPEC.md` is updated with the new tool.

---

## 0b. Deploy Plan Generator tool — NEXT

**Goal:** port the standalone prototype `generador-plan-despliegue.html` (kept locally, **not committed**: it contains internal system names and this repo is public) into a new tool. It builds a deployment-window plan (sections → steps with duration and owner), computes start/end times from a start hour, and copies an Outlook-ready HTML table to the clipboard.

### 0b.1 What the prototype does
- Inputs: title, start time (`HH:MM`), sections (fixed: INICIO, GO, ROLLBACK) each with steps `{ description, duration (min), owner }`; owner from a fixed list.
- Scheduling: steps run back to back across all sections; each step's start/end = running cursor; wraps past midnight (`fmtHora` mod 1440).
- Output: an email block (title, "Ventana: start a end | Duración total", table) built as an HTML string with inline styles tuned for Outlook Web (Calibri 10pt, header `#0F243E`, section rows `#8497B0`, pt widths, color on the inner `<span>` because Outlook overrides the `<td>` color, borders arranged to avoid doubles).
- Copy: `navigator.clipboard.write` with `text/html` + `text/plain` (tab-separated) and a `contenteditable` + `execCommand("copy")` fallback. Raw HTML textarea for pasting in code mode.
- Totals per section and overall.

### 0b.2 Issues found (fix while porting)
- **Start time not validated or normalized:** `"9:5"` is shown as-is in the header, garbage becomes `00:00`, and the raw value is inserted into the HTML **unescaped**.
- **Negative durations** can be typed (only the spinner respects `min=0`) and move the schedule backwards.
- **All sections are chained in time.** ROLLBACK (and GO, if it's a decision point) probably shouldn't continue the clock after the previous section — needs a product decision (see questions).
- "Estado" is always "Pendiente"; owners list and section names are hard-coded; steps can't be reordered; sections can't be added/renamed.
- No persistence: a reload loses the plan.
- `buildTable()` runs twice per render; empty sections still render a separator row (maybe intended).
- Default steps reference internal systems — replace with neutral examples before committing.

### 0b.3 Integration plan
- `src/lib/deployPlan/` (pure, testable):
  - `time.ts` — `parseTime` (strict `HH:MM`, returns null when invalid), `formatTime` (mod 24h).
  - `schedule.ts` — `schedulePlan(plan)` → rows with id, start, end, per-section and total minutes (single source for table, text and totals).
  - `emailHtml.ts` — builds the Outlook HTML string. Keep the prototype's inline-style approach and constants **as-is**; escape every user value (including the start time).
  - `plainText.ts` — tab-separated fallback for `text/plain`.
- `src/components/DeployPlanTool.tsx`: state `{ title, startTime, sections[{ id, name, steps[{ id, description, duration, owner }] }] }` with stable ids (not array indexes) via `useReducer`; editor on the left, preview on the right, stacked on narrow widths.
- **Preview in an `<iframe srcDoc>`**, not `dangerouslySetInnerHTML`: Tailwind's preflight resets `table`/`p` styles, so an inline preview wouldn't look like the email. The iframe shows exactly what gets pasted. The ~623pt table needs horizontal scroll inside the card.
- Clipboard behind a small adapter (`copyHtml(html, text)`) with the same fallback — matches the direction in task 1.
- UI strings through `useTranslation` (en/es/pt). The **email content** stays in Spanish unless decided otherwise.
- Register in `HomePage.tsx`, update `SPEC.md`.

### 0b.4 Open questions
1. Should GO / ROLLBACK times continue after the previous section, or restart from their own start (e.g. rollback starts where it would be triggered)?
2. Should sections be editable (add/rename/remove) and owners free text or a configurable list?
3. Should "Estado" be editable (Pendiente / En curso / OK / Error), making this also a tracker during the window?
4. Persist the last plan in `localStorage`? Import/export as JSON to reuse templates?
5. Email headers/content: always Spanish, or follow the UI language?

**Done when:** the tool is in the selector; editing a step updates times and preview instantly; "Copy for email" pastes into Outlook Web with the same look as the prototype; invalid start times and negative durations are rejected; `pnpm build` / lint green; SPEC updated.

---

## 1. Testability study (do this first)

**Goal:** decide whether — and where — to refactor before we start writing tests. The output of this task is a short written recommendation, not code.

**Why first:** several of the functions we want to test today live inside React components or inside `useEffect` closures. Testing them as they stand forces a heavy `@testing-library/react` setup for logic that is otherwise pure. A small amount of extraction up front makes the test suite much smaller and faster.

**Concrete things to assess:**

- For each tool, list every function/closure that contains logic worth testing (see §3 for the starting inventory) and classify it as:
  - **Pure** — no React, no DOM, no clock, no clipboard. Move to `src/lib/*.ts` and unit-test directly.
  - **React-bound** — depends on state/effects/refs. Test with `@testing-library/react` (or skip if the value is low).
  - **Browser-API-bound** — uses `navigator.clipboard`, `FileReader`, `setInterval`, `Date.now()`. Decide whether to inject the dependency (preferred) or mock it in the test.
- Pick a test runner and assertion style. Vitest is the natural fit for a Vite project (zero extra config, shares the Vite resolver, JSDOM available); confirm or pick an alternative.
- Decide on a coverage target (suggested floor: 80 % statements on extracted `src/lib/*` modules; React component coverage tracked separately and not gated).
- Decide on a folder convention — `*.test.ts` co-located with the source, or `tests/` mirror tree. Co-located is recommended.
- Identify the smallest set of refactors needed before writing tests. Candidates we already see:
  - Extract `analyzeData` and the formatting logic from `StringTool.tsx` into pure functions.
  - Extract `validateTemplate` and `validateJsonAgainstTemplate` from `JsonTool.tsx` (already pure — just move them).
  - Extract `buildTree` and `generateTemplate` from `JsonTemplaterTool.tsx` (already pure but currently nested inside `useEffect`).
  - Make `randomColor` in `HomePage.tsx` take an injectable RNG, or accept a list and an index.
  - Replace `Date.now()` for `instanceId` with an injectable id generator (also fixes the collision risk noted in `SPEC.md` §8).
  - Wrap clipboard / `FileReader` / `setInterval` access behind thin adapters so tools can be tested without those globals.

**Deliverable:** a short `docs/testability.md` (or an update to this file) listing:
1. The chosen test runner + setup steps.
2. The refactor list, each item tagged "do before tests" or "nice to have later".
3. A go/no-go decision per tool — if the cost of testing the React-bound surface outweighs the value, say so explicitly and limit scope to the extracted pure modules.

**Done when:** the recommendation is written down and we have agreed on a test runner.

---

## 2. Test runner setup

**Depends on:** task 1.

- Install the chosen runner (default assumption: `vitest` + `@vitest/ui` + `jsdom` + `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event`).
- Add `test` and `test:watch` (and optionally `test:coverage`) scripts to `package.json`.
- Add a minimal `vitest.config.ts` (or extend `vite.config.ts`) and a `src/test-setup.ts` that registers jest-dom matchers.
- Add one trivial smoke test (`src/smoke.test.ts` asserting `1 + 1 === 2`) to prove the pipeline works.
- Wire `pnpm test` into the existing `lint` / `build` workflow so it can later be the third correctness gate (alongside `tsc -b` and `eslint`).

**Done when:** `pnpm test` runs green locally and the smoke test is in the repo.

---

## 3. Tests per function

**Depends on:** task 2 (and any "do before tests" refactors from task 1).

Build one test file per source module under test. For each function below, write tests that cover at minimum: a happy path, an empty/zero input, and one malformed/edge case. Note for the implementer: this list reflects the code as it is today; after the task-1 refactors some of these functions will have moved to `src/lib/*`, so paths may change — update this list as you go.

### 3.1 StringTool (`src/components/StringTool.tsx`)
- `analyzeData` — empty input, single value, mixed comma + newline, items wrapped in `"` or `'`, items with surrounding whitespace, items containing the separator inside quotes (document current behaviour — the parser does **not** respect quotes when splitting).
- `updateFormattedOutput` — empty `parsedData`, comma separator, newline separator, no-quote / `'` / `"` quoting, items that already contain the quote character (verify the escape logic).
- `clearAll` — verify all three state slots reset.
- `copyToClipboard` — happy path writes to clipboard and flips `showCopied` true → false after 2 s; no-op when output is empty.

### 3.2 JsonTool (`src/components/JsonTool.tsx`)
- `validateTemplate` — valid template with multiple fields, valid template with empty `mandatoryFields`, missing `mandatoryFields`, non-object root, field missing `key`/`type`/`path`, non-string values, non-JSON text.
- `validateJsonAgainstTemplate` — all fields present, single missing field, missing nested field, `[]` array path with non-empty array, `[]` path with empty array (must mark missing), `[]` path where the key is not an array, path starting with `root.`, invalid input JSON (returns empty set per current behaviour — document this).
- Drag handlers (`handleDragOver`, `handleDragLeave`, `handleDrop`, `handleTemplateDrop`) — verify dragging-state flags, file-type rejection in `handleDrop`, `FileReader` success path (stub `FileReader`). These are React-bound; consider whether they're worth covering after the task-1 study.
- Debounced format effect — typing valid JSON yields formatted output after the 500 ms debounce; typing invalid JSON yields the error message and the partial-format fallback.

### 3.3 EpochTool (`src/components/EpochTool.tsx`)
- Conversion effect — empty input clears output; numeric seconds and milliseconds both convert correctly; non-numeric input yields `"Invalid epoch value"`; out-of-range numbers yield `"Invalid epoch value"`; `useUtc=true` sets the formatter's timeZone; `useMilliseconds` switches the divisor.
- `togglePrecision` — empty input is left untouched; numeric input is multiplied / divided by 1000 in the right direction; non-numeric input is left untouched.
- `handleCopy` — happy path flips label to `"Copied!"` then back; clipboard failure flips label to `"Failed"` then back.
- Live ticker effect — interval is cleared on unmount (use fake timers).

### 3.4 JsonTemplaterTool (`src/components/JsonTemplaterTool.tsx`)
- `buildTree` — primitive input, flat object, nested object, array of primitives (no descent), array of objects (descend into first element with `[]` in path), empty object/array, deeply nested mix.
- `generateTemplate` — empty `mandatoryFields` set → empty list; single selected leaf; selected branch + descendants; selected path that doesn't exist in the tree (verify current behaviour).
- `handleMandatoryChange` — adding a path, removing a path, removing a non-present path is a no-op.

### 3.5 HomePage (`src/routes/HomePage.tsx`)
- `addTool` — assigns `instanceId`, picks a color from the palette, appends; verify the duplicate-`instanceId` risk is gone after the task-1 refactor.
- `removeTool` — removes by `instanceId`; no-op for unknown id.
- `randomColor` — every returned value is in the palette (drive with a seeded/injected RNG so the test is deterministic).

### 3.6 useTranslation (`src/hooks/useTranslation.ts`)
- `t` — known key returns translated string; unknown key returns the key itself; `{param}` placeholders are substituted; multiple placeholders in one string; missing placeholder is left untouched.
- `toggleLanguage` — cycles `en → es → pt → en`.

**Done when:** every function listed here has tests, `pnpm test` is green, and the coverage target from task 1 is met for the extracted `src/lib/*` modules.

---

## 4. CI gate (stretch)

**Depends on:** task 3.

- Add a GitHub Actions workflow that runs `pnpm install`, `pnpm lint`, `pnpm build`, `pnpm test` on PRs against `develop`.
- Block merges on failure.

**Done when:** the workflow runs green on a sample PR.

---

## Notes

- Keep `SPEC.md` in sync as refactors move functions between files.
- Don't add tests that exercise React or browser APIs purely "for coverage" — they're slow and brittle. Prefer extracting pure logic.
- One commit per backlog item where practical; one PR per top-level section (1, 2, 3, 4) where practical.
