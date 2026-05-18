# Test Definitions — Ticket 152: Vendored-ignores export + install-time guidance + hygiene pass

## Rule 1 — Export shape & primitive

### Scenario 1.1: `configs.vendoredIgnores` is a typed, spreadable array

- [x] **Given** a consumer imports `safeword from 'safeword/eslint'`
      **When** they read `safeword.configs.vendoredIgnores`
      **Then** the value is a non-empty array (spreadable, matching the shape of `configs.vitest`/`configs.playwright`)
      **And** the `SafewordEslint` interface in `packages/cli/src/presets/typescript/index.ts` declares the field explicitly (no `any` leak beyond the existing `any[]` siblings)

### Scenario 1.2: The single config block inside the array is a `globalIgnores()` result

- [x] **Given** `safeword.configs.vendoredIgnores`
      **When** the consumer inspects the first (and only) entry
      **Then** the entry is a config object whose only meaningful key is `ignores` (the result of `globalIgnores([...])`)
      **And** no `rules`, `languageOptions`, or `files` keys exist on the block (so it stays a global ignore)

---

## Rule 2 — Exact ignore content

### Scenario 2.1: Exactly `.safeword/**` and `.dependency-cruiser.cjs`, no more, no less

- [x] **Given** the entry from Rule 1
      **When** the consumer reads its `ignores` array
      **Then** it contains exactly two strings: `'.safeword/**'` and `'.dependency-cruiser.cjs'`
      **And** no additional patterns are present (prevents silent scope creep)

### Scenario 2.2: Downstream ESLint run honors both patterns

- [x] **Given** a fixture project layout with `src/app.ts`, `.safeword/hooks/foo.ts`, and `.dependency-cruiser.cjs` (each containing a deliberate `no-console` violation), and an `eslint.config.mjs` written as

  ```js
  import { defineConfig } from 'eslint/config';
  import safeword from 'safeword/eslint';
  export default defineConfig([
    { files: ['**/*.{ts,cjs}'], rules: { 'no-console': 'error' } },
    ...safeword.configs.vendoredIgnores,
  ]);
  ```

  **When** ESLint runs against the project
  **Then** ESLint reports exactly one violation (in `src/app.ts`)
  **And** ESLint reports zero violations under `.safeword/`
  **And** ESLint reports zero violations for `.dependency-cruiser.cjs`

---

## Rule 3 — Install-time snippet trigger (setup)

### Scenario 3.1: Existing-config + JS-detected → snippet emitted exactly once

- [x] **Given** a project with a pre-existing `eslint.config.mjs` and a `package.json` declaring a JavaScript dependency
      **When** the user runs `safeword setup`
      **Then** the command output contains, exactly once, the literal snippet:

  ```
  import safeword from 'safeword/eslint';
  // … your existing configs
  ...safeword.configs.vendoredIgnores,
  ```

  **And** the snippet is preceded by a one-line explanation that references safeword's vendored hook scripts

### Scenario 3.2: No existing eslint config → no snippet

- [x] **Given** a JavaScript project with NO pre-existing ESLint config
      **When** the user runs `safeword setup`
      **Then** safeword writes `eslint.config.mjs` (existing behavior preserved)
      **And** the command output does not contain the `vendoredIgnores` snippet

### Scenario 3.3: Non-JS project → no snippet, regardless of stray eslint configs

- [x] **Given** a Python-only project with no detected `javascript` language layer, even if a stray `.eslintrc` exists from an unrelated tool
      **When** the user runs `safeword setup`
      **Then** the command output does not contain the `vendoredIgnores` snippet

---

## Rule 4 — Install-time snippet trigger (upgrade)

### Scenario 4.1: Upgrade in an existing-config project → snippet emitted

- [x] **Given** an already-initialized safeword project whose `eslint.config.mjs` was authored by the user (not safeword)
      **When** the user runs `safeword upgrade`
      **Then** the snippet is emitted exactly once with the same wording as Scenario 3.1

### Scenario 4.2: Upgrade where existing config already references `.safeword/` → snippet NOT emitted

- [x] **Given** an already-initialized safeword project whose `eslint.config.*` contains the substring `.safeword/` anywhere in its text (whether via safeword's own `getIgnores()` output, an explicit user-added ignore, or a prior application of the snippet itself)
      **When** the user runs `safeword upgrade`
      **Then** the command output does not contain the `vendoredIgnores` snippet
      **And** the snippet emission therefore self-quiesces once advice has been applied (no duplicate nag on repeated upgrades)

---

## Rule 5 — Regex hygiene (eslintrc + prettierrc patterns)

### Scenario 5.1: Rewritten eslintrc regex still matches every existing variant

- [x] **Given** the rewritten ESLint-config regex in `pre-tool-config-guard.ts`
      **When** tested against fixture file paths: `.eslintrc.json`, `.eslintrc.yaml`, `.eslintrc.yml`, `.eslintrc.js`, `.eslintrc.cjs`, `.eslintrc.mjs`, `.eslintrc`
      **Then** every fixture matches

### Scenario 5.2: Rewritten prettierrc regex still matches every existing variant

- [x] **Given** the rewritten Prettier-config regex in `pre-tool-config-guard.ts`
      **When** tested against fixture file paths: `.prettierrc.json`, `.prettierrc.yaml`, `.prettierrc.yml`, `.prettierrc.js`, `.prettierrc.cjs`, `.prettierrc.mjs`, `.prettierrc`
      **Then** every fixture matches

### Scenario 5.3: Rewritten regexes reject non-config paths (regression guard)

- [x] **Given** the rewritten regexes
      **When** tested against irrelevant paths: `eslintrc-readme.md`, `prettier-plugin-foo.js`, `README.md`, `src/prettierrc.ts`
      **Then** none match

### Scenario 5.4: Rewritten regexes pass `security/detect-unsafe-regex`

- [x] **Given** the rewritten regexes
      **When** safeword's strict ESLint preset runs against `pre-tool-config-guard.ts`
      **Then** zero `security/detect-unsafe-regex` violations report on lines 27 or 39

---

## Rule 6 — Cleanup-catch hygiene

### Scenario 6.1: `cursor/stop.ts:~57` cleanup catch is debug-logged

- [x] **Given** the rewritten line in `.safeword/hooks/cursor/stop.ts`
      **When** the file is read
      **Then** no empty arrow function `() => {}` remains in the marker-file cleanup `.catch(...)`
      **And** the catch logs the error to `console.error` guarded by `process.env.DEBUG`, matching the project pattern at [post-tool-lint.ts:20](.safeword/hooks/post-tool-lint.ts:20)

### Scenario 6.2: Cleanup-catch behavior unchanged on missing marker file

- [x] **Given** the rewritten cleanup catch
      **When** the stop hook runs in a session where the marker file does not exist (so `unlink` rejects with ENOENT)
      **Then** the hook exits successfully with the same followup_message payload as before
      **And** no error noise reaches stdout/stderr in the default (`DEBUG` unset) case

---

## Rule 7 — Pair-parity & repo health

### Scenario 7.1: Vendored + template edits stay in sync

- [x] **Given** edits to `.safeword/hooks/pre-tool-config-guard.ts` and `.safeword/hooks/cursor/stop.ts`
      **When** the pair-parity release-gate test runs
      **Then** the test passes
      **And** `diff -r packages/cli/templates/hooks/ .safeword/hooks/` shows no differences for the two edited files

### Scenario 7.2: `bun run lint` stays green at repo root

- [x] **Given** the implementation lands
      **When** `bun run lint` runs from the repo root
      **Then** exit code is 0
      **And** no new errors appear in any file under `packages/cli/`

### Scenario 7.3: Vitest suite stays green

- [x] **Given** the implementation lands
      **When** `npx vitest run` runs from `packages/cli/`
      **Then** all tests pass
      **And** the new unit tests for `vendoredIgnores` shape, regex hygiene, and setup-output conditional are all included in the run
