# Backlog

Ordered list of upcoming work. Pick tasks top-down; later tasks assume earlier ones are done.

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
