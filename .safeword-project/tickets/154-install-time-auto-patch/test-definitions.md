# Test Definitions — Ticket 154: Install-time auto-patch of consumer's ESLint config

## Rule 1 — Recognized flat-config shapes get patched

### Scenario 1.1: Bare array `eslint.config.mjs` gets patched in place

- [x] **Given** a project with `eslint.config.mjs` whose body is `export default [ { files: ['**/*.ts'] } ];` and `package.json` declaring a JavaScript dep
      **When** the user runs `safeword setup`
      **Then** `eslint.config.mjs` now contains `import safeword from 'safeword/eslint';` near the top
      **And** the array contains `...safeword.configs.vendoredIgnores,` before its closing `]`
      **And** `eslint.config.mjs.safeword-bak` exists with the pre-edit contents
      **And** the command output contains a confirmation line referencing both paths

### Scenario 1.2: `defineConfig(...)` wrapper gets patched inside the call

- [x] **Given** a project with `eslint.config.mjs` whose body is

  ```js
  import { defineConfig } from 'eslint/config';
  export default defineConfig([{ files: ['**/*.ts'] }]);
  ```

  **When** the user runs `safeword setup`
  **Then** the spread is inserted inside the `defineConfig(...)` array, not after it
  **And** the resulting file passes `node --check`

### Scenario 1.3: All six flat-config extensions are recognized

- [x] **Given** six otherwise-identical projects with the export at `eslint.config.{mjs,js,cjs,ts,mts,cts}` respectively (each a bare array literal — the six filenames ESLint v9 discovers per `config-loader.js:43-50`)
      **When** the user runs `safeword setup` on each
      **Then** each file is patched (spread inserted, import added, backup written)

### Scenario 1.5: CRLF line endings preserved through the edit

- [x] **Given** a project with an `eslint.config.mjs` written with CRLF line endings (Windows-edited or IDE-configured) and no `vendoredIgnores` reference
      **When** the user runs `safeword setup`
      **Then** the patched file uses CRLF line endings throughout (no mixed LF/CRLF, no LF-only regression)
      **And** the inserted import line and spread line each end in CRLF

### Scenario 1.4: Import block already contains `safeword/eslint` → don't duplicate

- [x] **Given** a project whose `eslint.config.mjs` already imports `safeword from 'safeword/eslint'` for some other reason (e.g., for `recommendedTypeScript`)
      **When** the user runs `safeword setup`
      **Then** only the array spread is inserted; the import line is not duplicated

---

## Rule 2 — Idempotency by substring

### Scenario 2.1: Re-running after a successful auto-patch is silent

- [x] **Given** a project whose `eslint.config.mjs` already contains `vendoredIgnores` (from a prior `safeword setup` auto-patch)
      **When** the user runs `safeword setup` again
      **Then** the config is not modified a second time (mtime / content unchanged)
      **And** no confirmation line is printed
      **And** no 153 print-nudge is emitted

### Scenario 2.2: Manual 153-nudge application is recognized as already-patched

- [x] **Given** a project whose `eslint.config.mjs` the user hand-edited last week (after reading the 153 print-nudge) to spread `vendoredIgnores` themselves
      **When** the user runs `safeword upgrade`
      **Then** the config is not modified
      **And** the 153 print-nudge does not re-emit

---

## Rule 3 — Opt-out short-circuits auto-patch

### Scenario 3.1: `--no-modify` flag falls through to 153 print-nudge

- [x] **Given** a project with an existing `eslint.config.mjs` that does NOT contain `vendoredIgnores`
      **When** the user runs `safeword setup --no-modify`
      **Then** the config is byte-identical to its pre-command state
      **And** no `.safeword-bak` is created
      **And** the 153 print-nudge fires (the snippet is printed for the user)

### Scenario 3.2: `SAFEWORD_NO_MODIFY=1` env var has the same effect as the flag

- [x] **Given** the same setup as 3.1 but with `SAFEWORD_NO_MODIFY=1` exported and no `--no-modify` flag
      **When** the user runs `safeword setup`
      **Then** the config is byte-identical to its pre-command state
      **And** no `.safeword-bak` is created
      **And** the 153 print-nudge fires

### Scenario 3.3: Opt-out plus already-patched state stays silent

- [x] **Given** a project whose `eslint.config.mjs` already contains `vendoredIgnores` AND the user passes `--no-modify`
      **When** the user runs `safeword setup`
      **Then** the config is unchanged
      **And** the 153 print-nudge is skipped (its own substring gate fires before emission)

---

## Rule 4 — Bail-to-print on unrecognized export shapes

### Scenario 4.1: Function-returning-config bails to print

- [x] **Given** a project whose `eslint.config.mjs` is `export default () => [ /* ... */ ];`
      **When** the user runs `safeword setup`
      **Then** the file is byte-identical to its pre-command state
      **And** no `.safeword-bak` is created
      **And** the 153 print-nudge fires

### Scenario 4.2: Single-imported-config bails to print

- [x] **Given** a project whose `eslint.config.mjs` is `import cfg from './shared.mjs'; export default cfg;`
      **When** the user runs `safeword setup`
      **Then** the file is unchanged
      **And** the 153 print-nudge fires

### Scenario 4.3: `defineConfig(...)` wrapping a non-array call bails

- [x] **Given** a project whose `eslint.config.mjs` is `export default defineConfig(getConfig());`
      **When** the user runs `safeword setup`
      **Then** the file is unchanged
      **And** the 153 print-nudge fires

### Scenario 4.4: Unrecognized custom wrapper bails

- [x] **Given** a project whose `eslint.config.mjs` is `export default makeMyConfig([ /* ... */ ]);` (`makeMyConfig` is not `defineConfig`)
      **When** the user runs `safeword setup`
      **Then** the file is unchanged
      **And** the 153 print-nudge fires

---

## Rule 5 — Safety: I/O failures and syntax-check failures revert cleanly

### Scenario 5.1: Post-edit syntax check fails → backup restored, print-nudge fires

- [x] **Given** an edge-case config that survives the textual-insertion heuristic but the resulting file fails `node --check` (e.g., due to a comment placement quirk the heuristic doesn't catch)
      **When** the user runs `safeword setup`
      **Then** the on-disk `eslint.config.mjs` is byte-identical to its pre-command state (restored from `.safeword-bak`)
      **And** the 153 print-nudge fires
      **And** the command exits successfully (a botched auto-patch is not a fatal error)

### Scenario 5.2: Write failure mid-edit leaves no half-state

- [x] **Given** a project where `eslint.config.mjs` is writeable but the directory becomes read-only between backup and write (or a similar I/O fault is simulated)
      **When** the user runs `safeword setup`
      **Then** if the original file was untouched, no backup is left orphaned
      **And** the 153 print-nudge fires

### Scenario 5.4: TypeScript configs skip `node --check`

- [x] **Given** a project with `eslint.config.ts` (or `.mts` / `.cts`) containing a bare array literal export with TypeScript-specific syntax (`as const`, type annotations) that `node --check` would reject even though the file is valid TS
      **When** the user runs `safeword setup`
      **Then** the auto-patch proceeds without invoking `node --check` (the textual insert is trusted on TS variants)
      **And** the file is patched and the confirmation prints
      **And** no spurious revert-from-backup occurs

### Scenario 5.3: Read failure on the eslint config falls through to print

- [x] **Given** a project where `existingEslintConfig` is reported as `eslint.config.mjs` but the file is unreadable (permissions, mid-deletion)
      **When** the user runs `safeword setup`
      **Then** no edit is attempted
      **And** the 153 print-nudge fires (conservatively, matching the existing 153 behavior on unreadable configs)

---

## Rule 6 — Wiring parity: setup and upgrade behave identically

### Scenario 6.1: `safeword upgrade` auto-patches the same way as `setup`

- [x] **Given** any of the scenarios in Rule 1 (e.g., a bare-array `eslint.config.mjs`)
      **When** the command is `safeword upgrade` instead of `safeword setup`
      **Then** the same patch lands, the same backup is written, and the same confirmation prints

### Scenario 6.2: Upgrade on a project safeword originally generated (config already references `.safeword/`) stays silent

- [x] **Given** a safeword-generated `eslint.config.mjs` whose `getIgnores()` already covers `.safeword/` (i.e., the config text contains `.safeword/` but NOT `vendoredIgnores`)
      **When** the user runs `safeword upgrade`
      **Then** auto-patch still runs (idempotency is keyed on `vendoredIgnores`, not `.safeword/`) and inserts the spread
      **And** the result is a config that has BOTH `getIgnores()` AND `vendoredIgnores` — redundant but correct, no double-ignore failure mode

### Scenario 6.3: Non-JS project never engages auto-patch

- [x] **Given** a Python-only project with no `javascript` language detected
      **When** the user runs `safeword setup`
      **Then** auto-patch is never invoked (no file reads, no backups, no edits)
      **And** no 153 print-nudge is emitted

---

## Rule 7 — Repo health stays green

### Scenario 7.1: `bun run lint` stays green at repo root

- [x] **Given** the implementation lands
      **When** `bun run lint` runs from the repo root
      **Then** exit code is 0

### Scenario 7.2: Full vitest suite stays green

- [x] **Given** the implementation lands
      **When** `npx vitest run` runs from `packages/cli/`
      **Then** all tests pass; the new unit tests for the auto-patcher, the opt-out wiring, and the bail paths are all included

### Scenario 7.3: Type-check is clean

- [x] **Given** the implementation lands
      **When** `bunx tsc --noEmit -p packages/cli` runs
      **Then** there are no type errors
