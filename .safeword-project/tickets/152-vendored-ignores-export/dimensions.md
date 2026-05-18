# Dimensions — Ticket 152

Derived from intake: scope (new export + install-time guidance + 3-file hygiene pass), resolved open questions (name = `vendoredIgnores` under `configs.*` namespace, use `globalIgnores()` primitive, no auto-patching, no version pinning), constraints (pair-parity between `.safeword/hooks/` and `packages/cli/templates/hooks/`, no behavior change for fresh-project install path).

## Behavioral dimensions

| Dimension                  | Partitions                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| Export shape               | array-spreadable (matches sibling `configs.*`) / single-object (rejected, breaks namespace)        |
| Ignore primitive used      | `globalIgnores([...])` (chosen) / bare `ignores`-only object (rejected, implicit semantics)        |
| Ignored path kind          | directory pattern (`.safeword/**`) / file path (`.dependency-cruiser.cjs`)                         |
| Consumer config state      | no-existing-eslint-config (fresh) / has-existing-eslint-config (downstream pain point)             |
| Project language detection | javascript-detected / non-javascript-only (Python, Go)                                             |
| Setup command invoked      | `safeword setup` (first-time install) / `safeword upgrade` (already-installed)                     |
| Snippet emission           | emitted-once / not-emitted / never-emitted-twice                                                   |
| Regex input class          | matches expected ext variant / matches no-ext (`.eslintrc`) / matches non-config (must not)        |
| Regex extension coverage   | `.json` / `.yaml` / `.yml` / `.js` / `.cjs` / `.mjs` / bare (`.eslintrc`)                          |
| Regex lint state           | `security/detect-unsafe-regex` flags pre-edit / passes post-edit                                   |
| Cleanup catch state        | empty `() => {}` (pre-edit, flags `no-empty-function`) / debug-logged (post-edit, intent-explicit) |
| Pair-parity surface        | vendored `.safeword/hooks/` / template `packages/cli/templates/hooks/`                             |
| Type safety of export      | declared in `SafewordEslint` interface / leaks as `any` (rejected)                                 |

## Boundary cases

- Existing-config project that is **also** non-JS (e.g., Python project with stray legacy `.eslintrc`) → snippet NOT emitted (JS gating wins over existence)
- `safeword upgrade` on a project where safeword owns `eslint.config.mjs` (fresh-style install) → snippet NOT emitted (the user doesn't need it; safeword's generated config already ignores `.safeword/`)
- Setup run twice back-to-back in an existing-config project → snippet emitted on each run (idempotent informational output; not gated by state)
- Regex run against `.eslintrc` (no extension) → must match (preserves existing behavior)
- Regex run against `eslintrc-readme.md` or `prettier-plugin-foo.js` → must NOT match (regression guard for the cleanup)
- Stop hook runs and the marker file already absent → cleanup catch path fires; with the new debug-logged catch, no user-visible noise unless `DEBUG` is set
- Template/vendored drift (someone edits one but not the other) → release-gate parity test fails

## Rule mapping

- Export shape × Ignore primitive × Type safety → **Rule: `configs.vendoredIgnores` is a typed, spreadable array containing one `globalIgnores([...])` block**
- Ignored path kind (directory + file) → **Rule: Export carries exactly `.safeword/**`and`.dependency-cruiser.cjs`, no more, no less\*\*
- Consumer config state × Project language × Setup command → **Rule: Snippet is emitted iff (existing-eslint-config AND javascript-detected), in both `setup` and `upgrade`**
- Snippet emission idempotency → **Rule: Snippet appears at most once per command invocation; safe to repeat across runs**
- Regex input class × Regex extension coverage × Regex lint state → **Rule: Rewritten regexes preserve match set for all existing extension variants, reject non-config paths, and pass `security/detect-unsafe-regex`**
- Cleanup catch state → **Rule: Cleanup catches in vendored hooks log under `DEBUG` rather than swallow silently — eliminates `no-empty-function` and signals intent**
- Pair-parity surface → **Rule: Every edit under `.safeword/hooks/` lands identically in `packages/cli/templates/hooks/`; release-gate parity test enforces**

## Out-of-scope dimensions

- Legacy `.eslintrc.*` consumer configs — snippet still works (it's just ESM import + array spread), but we do NOT detect format and emit a tailored variant
- ESLint v9-vs-v10 plugin compatibility — analysed prior turn, not the root cause of the reported errors
- Auto-patching the consumer's existing ESLint config — explicitly ruled out (too many parser variants, corruption risk)
- Per-site disables for the 77 `security/detect-non-literal-fs-filename` warnings — eliminated as a class once consumers spread the export; no per-site assertions
- Migrating `.dependency-cruiser.cjs` to ESM — separate concern; for now the export ignores it
- Rule-override variants of the export (e.g., "lint `.safeword/**` but with these rules disabled") — no concrete demand; ignore-only keeps the API minimal

## Card-ratio self-check

- **Rules:** 7. Each gets 1-3 scenarios.
- **Target scenarios:** ~14.
- **Open questions remaining at this phase:** 0 (export name, primitive, namespace placement, snippet trigger, and pair-parity all resolved in prior turns).
