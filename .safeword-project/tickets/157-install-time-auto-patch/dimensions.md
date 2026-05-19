# Dimensions — Ticket 157

Derived from intake: scope (auto-patch flat eslint configs at install/upgrade time), locked decisions (textual insertion, `defineConfig` inline, just-do-it default, `--no-modify` opt-out, idempotency by substring, `.safeword-bak` backup, syntax-check + revert on fail, bail-to-156-print on uncertainty), constraints (no AST parsing, no interactive prompts, legacy `.eslintrc.*` deferred).

## Behavioral dimensions

| Dimension                   | Partitions                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Config format               | flat .mjs / flat .js / flat .cjs / flat .ts / flat .mts / flat .cts / legacy .eslintrc.\* / package.json#eslintConfig |
| Line-ending style           | LF (Unix) / CRLF (Windows) — must be preserved through the edit                                                       |
| Syntax-check strategy       | `node --check` for `.mjs/.js/.cjs` / skipped for TS variants (`.ts/.mts/.cts`)                                        |
| Default-export shape        | bare array literal / `defineConfig(...)` wrapper / function-returning-config / single-imported-config / function      |
| Import-block state          | `import safeword from 'safeword/eslint'` present / absent                                                             |
| Config text contains marker | `vendoredIgnores` present (idempotent skip) / absent (proceed)                                                        |
| Project language detection  | javascript-detected / non-javascript-only                                                                             |
| Existing-config detection   | exists / absent (fresh project — handled by managed-files writer, not this code path)                                 |
| Command invoked             | `safeword setup` / `safeword upgrade`                                                                                 |
| Opt-out signal              | `--no-modify` flag / `SAFEWORD_NO_MODIFY` env var / neither (default just-do-it)                                      |
| Post-edit syntax check      | passes (commit) / fails (revert from backup, fall through to print)                                                   |
| File-system operation       | read ok / read fails / write ok / write fails / backup creation fails                                                 |
| Backup file pre-existence   | absent (write fresh) / present (overwrite — last edit wins)                                                           |
| Outcome path                | auto-patched (confirmation printed) / idempotent skip (silent) / opt-out (print-nudge) / bail (print-nudge)           |

## Boundary cases

- Config is a flat `.mjs` with `defineConfig(...)` wrapper and a bare array inside → patch inside the wrapper, not after it
- Config is a flat `.mjs` with `export default [...]` and no `defineConfig` → insert before the closing `]`
- Config already contains `vendoredIgnores` (because user followed 156's print-nudge last week) → no-op, no nag
- Config is `eslint.config.ts` with TypeScript-typed config (e.g., `: Linter.Config[]`) → textual approach handles it; TS-specific syntax doesn't affect the closing `]` find
- Config is `.mts` or `.cts` → same heuristic as `.ts`; recognized as flat config
- Config uses CRLF line endings (Windows-edited) → patched lines also use CRLF; the file's mixed-ending state must not regress to all-LF
- Config is TypeScript (any TS variant) → `node --check` skipped; textual insertion trusted
- Default export is `export default eslintConfigPrettier` (a single imported config) → bail to print
- Default export is `export default () => [...]` (function-returning-config) → bail to print
- `defineConfig(...)` wrapper but `defineConfig(getConfig())` where `getConfig()` is a function call → no array literal inside the wrapper → bail to print
- Post-edit `node --check` fails (e.g., we mis-inserted) → restore from `.safeword-bak`, fall through to print
- `--no-modify` flag passed but config is already patched (idempotent state) → flag wins; print-nudge runs and skips its own emission via the existing 156 substring check
- `SAFEWORD_NO_MODIFY=1` set but `--no-modify` flag NOT passed → env var wins; same opt-out behavior
- Project is non-JS (no `languages.javascript`) → auto-patch never runs; 156's nudge also doesn't run (its own gate)
- Multiple flat configs in a monorepo (root + `packages/*/eslint.config.mjs`) → patch the root only; don't recurse
- Backup file already exists from a prior auto-patch attempt → overwrite (most recent edit is the right one to be able to revert to)

## Rule mapping

- Config format × Default-export shape × Import-block state → **Rule: Recognized flat-config shape gets patched; everything else bails to print**
- Config text marker → **Rule: Idempotency by substring; `vendoredIgnores` present means no-op**
- Opt-out signal × Outcome path → **Rule: Either opt-out signal short-circuits auto-patch and falls through to 156's print-nudge with config untouched**
- Post-edit syntax check × File-system operation → **Rule: Any I/O or syntax failure restores from backup and falls through to print; no partial state remains**
- Outcome path × user-facing output → **Rule: Auto-patched → print confirmation with paths; bail/opt-out → 156 print-nudge fires its own logic; idempotent skip → silent**
- Command invoked × all of the above → **Rule: Both `setup` and `upgrade` exhibit identical auto-patch behavior**

## Out-of-scope dimensions

- Legacy `.eslintrc.*` (json/yaml/js/cjs) — bail to print on any of these; auto-patching them is a separate deferred ticket
- `package.json#eslintConfig` — same
- Monorepo nested configs — root-only; nested patching is the user's call
- Custom wrappers other than `defineConfig` — bail (no realistic way to know the wrapper preserves array semantics)
- Function-returning-config pattern — bail (can't textually find an array to mutate)
- AST/parser-based fallback when textual fails — explicitly rejected; bail-to-print is the only fallback
- Interactive prompt (`Patch? [Y/n]`) — rejected in scope; flag/env var is the opt-out
- Restoring the backup automatically on next run if user manually undoes the patch — not safeword's concern; backup is a one-shot revert artifact

## Card-ratio self-check

- **Rules:** 7. Each gets 2-4 scenarios.
- **Target scenarios:** ~22.
- **Open questions remaining at this phase:** 0 (format scope, opt-out shape, confirmation behavior, defineConfig handling, all resolved in intake).
